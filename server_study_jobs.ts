import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import PDFDocument from "pdfkit";
import { executeResilientAI, DEFAULT_MODEL } from "./src/services/ai_resiliency.ts";
import { loadJob, saveJob, JobState, accountAICost } from "./server_jobs.ts";

export const STORAGE_PDF_DIR = path.join(process.cwd(), "storage", "study_pdfs");

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_PDF_DIR)) {
    fs.mkdirSync(STORAGE_PDF_DIR, { recursive: true });
  }
}

export function getStudyPdfPath(jobId: string): string {
  ensureStorageDir();
  return path.join(STORAGE_PDF_DIR, `${jobId}.pdf`);
}

/**
 * Ensures Unicode Bengali fonts (NotoSansBengali) are downloaded and present on disk.
 */
function ensureBengaliFontsExist() {
  const fontDir = path.join(process.cwd(), "fonts");
  if (!fs.existsSync(fontDir)) {
    fs.mkdirSync(fontDir, { recursive: true });
  }
  const regPath = path.join(fontDir, "NotoSansBengali-Regular.ttf");
  const boldPath = path.join(fontDir, "NotoSansBengali-Bold.ttf");

  if (!fs.existsSync(regPath) || !fs.existsSync(boldPath)) {
    console.log("[PDF Quality Engine] Downloading Unicode NotoSansBengali TTF fonts for publication rendering...");
    try {
      execSync(`curl -sSL -o "${regPath}" "https://github.com/google/fonts/raw/main/ofl/notosansbengali/static/NotoSansBengali-Regular.ttf"`, { timeout: 15000 });
      execSync(`curl -sSL -o "${boldPath}" "https://github.com/google/fonts/raw/main/ofl/notosansbengali/static/NotoSansBengali-Bold.ttf"`, { timeout: 15000 });
    } catch (e) {
      console.warn("[PDF Quality Engine] Font auto-download notice:", e);
    }
  }
}

function hasBengaliText(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text || "");
}

function hasHindiText(text: string): boolean {
  return /[\u0900-\u097F]/.test(text || "");
}

/**
 * Strips all raw Markdown syntax artifacts and Hindi characters to guarantee clean publication text.
 */
function cleanMarkdownFormatting(str: string): string {
  if (!str) return "";
  return str
    .replace(/[\u0900-\u097F]/g, '') // Strict rule: Strip any Hindi/Devanagari characters
    .replace(/^#{1,6}\s*/, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^>\s*/, '')
    .replace(/^[\-\*\•\✓]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/---/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\pi/g, 'π')
    .replace(/\\triangle/g, 'triangle')
    .replace(/\$+/g, '')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .trim();
}

/**
 * Automated Verification Step before export:
 * Checks language purity, font rendering, markdown syntax, and buffer integrity.
 */
function auditPdfPreExportQuality(
  content: string, 
  languageEdition: 'english' | 'bengali', 
  hasBengaliFont: boolean
): void {
  // Check 1: No Hindi characters permitted anywhere
  if (hasHindiText(content)) {
    console.warn("[Quality Audit Notice] Devanagari/Hindi characters detected in input content. Sanitizing automatically.");
  }

  // Check 2: Bengali Font & Language Policy Verification
  if (languageEdition === 'bengali') {
    if (!hasBengaliFont) {
      throw new Error("STRICT PDF QUALITY CONTROL FAILURE: Bengali Edition requested but Unicode NotoSansBengali font is not registered.");
    }
  } else if (languageEdition === 'english') {
    if (hasBengaliText(content)) {
      console.warn("[Quality Audit Notice] Bengali characters detected inside English Edition. Stripping mixed Bengali for strict single-language PDF policy.");
    }
  }
}

/**
 * Generates a modern, publication-quality PDF buffer using PDFKit.
 * Enforces strict quality control:
 * - Separate English or Bengali PDF (never mixed)
 * - Beautiful color themes (Navy/Indigo for English, Emerald/Teal for Bengali)
 * - Publication cover page & metadata cards
 * - Zero raw markdown artifacts
 * - Dynamic cell/table wrapping and page split protection
 * - Running headers and footers with Page X of Y
 */
export async function buildStudyMaterialPdfBuffer(
  content: string, 
  topic: string, 
  languageEdition: 'english' | 'bengali' = 'english'
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      ensureBengaliFontsExist();

      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        bufferPages: true,
        info: {
          Title: `${topic} - MissionGrid Study Material (${languageEdition.toUpperCase()} EDITION)`,
          Author: 'MissionGrid Academic Research Team',
          Subject: 'Publication Grade Educational Study Guide',
          Keywords: 'MissionGrid, Study Material, SSC, Banking, Railway, UPSC, Bengali, English'
        }
      });

      const fontDir = path.join(process.cwd(), "fonts");
      const regBengaliPath = path.join(fontDir, "NotoSansBengali-Regular.ttf");
      const boldBengaliPath = path.join(fontDir, "NotoSansBengali-Bold.ttf");

      let hasBengaliFont = false;
      if (fs.existsSync(regBengaliPath) && fs.existsSync(boldBengaliPath)) {
        try {
          doc.registerFont('Bengali', regBengaliPath);
          doc.registerFont('Bengali-Bold', boldBengaliPath);
          hasBengaliFont = true;
        } catch (e) {
          console.warn('[PDF Engine] Could not register Bengali TTF fonts:', e);
        }
      }

      // Pre-Export Quality Control Check
      auditPdfPreExportQuality(content, languageEdition, hasBengaliFont);

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        // Quality Check: Buffer Size
        if (buffer.length < 5000) {
          return reject(new Error("STRICT PDF QUALITY CONTROL FAILURE: Generated PDF buffer size is abnormally small (< 5KB)."));
        }
        
        resolve(buffer);
      });
      doc.on('error', (err) => reject(err));

      // Theme Colors Definition
      const isBnEdition = languageEdition === 'bengali';
      const themePrimary = isBnEdition ? '#064e3b' : '#1e1b4b';  // Dark Emerald vs Navy
      const themeAccent = isBnEdition ? '#059669' : '#4f46e5';   // Teal vs Indigo
      const themeSubtleBg = isBnEdition ? '#f0fdf4' : '#f8fafc'; // Mint vs Ice Blue
      const themeBorder = isBnEdition ? '#a7f3d0' : '#e2e8f0';   // Light Green vs Slate Border
      const themeHeaderBadge = isBnEdition ? '#047857' : '#312e81';
      const themeBadgeText = isBnEdition ? '#d1fae5' : '#e0e7ff';

      // Clean content according to edition rules
      let cleanContent = (content || "").replace(/[\u0900-\u097F]/g, ''); // Strip Hindi
      if (!isBnEdition) {
        // In English edition, if Bengali text sneaks in, clean or strip it
        cleanContent = cleanContent.replace(/[\u0980-\u09FF]+/g, '');
      }

      cleanContent = cleanContent
        .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷')
        .replace(/\\le/g, '≤')
        .replace(/\\ge/g, '≥')
        .replace(/\\neq/g, '≠')
        .replace(/\\pi/g, 'π')
        .replace(/\\triangle/g, 'triangle')
        .replace(/\$+/g, '')
        .replace(/\\text\{([^}]+)\}/g, '$1');

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const printableWidth = pageWidth - 80; // 515.28
      const leftMargin = 40;

      // Font Helper function to dynamically switch fonts for Bengali / English
      const applyFont = (text: string, isBold: boolean, size: number) => {
        if ((hasBengaliText(text) || isBnEdition) && hasBengaliFont) {
          doc.font(isBold ? 'Bengali-Bold' : 'Bengali').fontSize(size);
        } else {
          doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
        }
      };

      // ==========================================
      // PAGE 1: PUBLICATION COVER PAGE
      // ==========================================
      // Header Banner
      doc.rect(0, 0, pageWidth, 200).fill(themePrimary);
      doc.rect(0, 195, pageWidth, 5).fill(themeAccent);

      // Cover Page Header Text
      applyFont('MISSIONGRID', true, 32);
      doc.fillColor('#ffffff').text('MISSIONGRID', leftMargin, 45);
      applyFont('LEARN. PRACTICE. SUCCEED.', false, 11);
      doc.fillColor(isBnEdition ? '#a7f3d0' : '#a5b4fc').text('LEARN. PRACTICE. SUCCEED.', leftMargin, 85);
      
      // Badge Box on Cover Header
      doc.roundedRect(leftMargin, 120, 270, 26, 13).fill(themeHeaderBadge);
      const editionBadgeLabel = isBnEdition 
        ? '📗 OFFICIAL BENGALI EDITION (বাংলা সংস্করণ)' 
        : '📘 OFFICIAL ENGLISH EDITION';
      applyFont(editionBadgeLabel, true, 8.5);
      doc.fillColor(themeBadgeText).text(editionBadgeLabel, leftMargin + 15, 128);

      // Main Chapter Title
      let currentY = 240;
      const cleanTopic = cleanMarkdownFormatting(topic || "MissionGrid Study Material");
      applyFont(cleanTopic, true, 24);
      doc.fillColor('#0f172a').text(cleanTopic, leftMargin, currentY, { width: printableWidth, align: 'left' });
      currentY = doc.y + 15;

      // Subtitle Divider
      doc.rect(leftMargin, currentY, 80, 4).fill(themeAccent);
      currentY += 25;

      // Metadata & Publication Card
      const metaCardY = currentY;
      doc.roundedRect(leftMargin, metaCardY, printableWidth, 120, 8).fillAndStroke(themeSubtleBg, themeBorder);
      
      const metaTitle = isBnEdition ? 'প্রকাশনা মেটাডেটা (PUBLICATION METADATA)' : 'PUBLICATION METADATA';
      applyFont(metaTitle, true, 11);
      doc.fillColor(isBnEdition ? '#065f46' : '#334155').text(metaTitle, leftMargin + 20, metaCardY + 15);
      
      applyFont('Details', false, 9.5);
      doc.fillColor('#475569');
      doc.text(`• Series: MissionGrid Master Class Study Guide Series`, leftMargin + 20, metaCardY + 38);
      doc.text(`• Target Exams: SSC, Banking, Railway, UPSC, State PSC Exams`, leftMargin + 20, metaCardY + 55);
      doc.text(`• Academic Publisher: MissionGrid Academic & AI Mentor Research Team`, leftMargin + 20, metaCardY + 72);
      doc.text(`• Edition: ${isBnEdition ? '100% Bengali Edition (বাংলা বই সংস্করণ)' : '100% English Edition (Standard Study Book)'}`, leftMargin + 20, metaCardY + 89);

      currentY = metaCardY + 145;

      // Features / Highlights Card
      const featuresY = currentY;
      doc.roundedRect(leftMargin, featuresY, printableWidth, 130, 8).fillAndStroke(isBnEdition ? '#f0fdf4' : '#eff6ff', isBnEdition ? '#86efac' : '#93c5fd');
      
      const featuresTitle = isBnEdition ? 'বইয়ের প্রধান বৈশিষ্ট্যসমূহ (BOOK HIGHLIGHTS & FEATURES)' : 'BOOK HIGHLIGHTS & LEARNING FEATURES';
      applyFont(featuresTitle, true, 11);
      doc.fillColor(isBnEdition ? '#166534' : '#1e40af').text(featuresTitle, leftMargin + 20, featuresY + 15);
      
      applyFont('Highlights', false, 9.5);
      doc.fillColor(isBnEdition ? '#15803d' : '#1d4ed8');
      doc.text('✓ Structured 14-Section Comprehensive Mastery Layout', leftMargin + 20, featuresY + 38);
      doc.text('✓ Visual Memory Cards, Mnemonics & Sound Associations', leftMargin + 20, featuresY + 55);
      doc.text('✓ Exam Trend Analysis, PYQ Notes & Shortcut Formulas', leftMargin + 20, featuresY + 72);
      doc.text('✓ High-Retention Active Recall & Common Mistake Alerts', leftMargin + 20, featuresY + 89);
      doc.text('✓ Quick Revision Summary & One-Page Exam Formula Sheet', leftMargin + 20, featuresY + 106);

      // Cover Page Footer Note
      applyFont('MissionGrid • Learn. Practice. Succeed.', false, 8.5);
      doc.fillColor('#94a3b8').text('MissionGrid • Learn. Practice. Succeed. • Confidential Educational Resource', leftMargin, pageHeight - 50, { align: 'center', width: printableWidth });

      // PAGE BREAK -> CONTENT STARTS ON PAGE 2
      doc.addPage();

      const maxY = pageHeight - 60;
      function checkPageBreak(needed = 25) {
        if (doc.y + needed > maxY) {
          doc.addPage();
          doc.y = 55;
        }
      }

      doc.y = 55; // Start of page 2 content

      // Parse Markdown lines
      const lines = cleanContent.split('\n');
      let inTable = false;
      let tableRows: string[][] = [];

      const flushTable = () => {
        if (tableRows.length === 0) return;
        
        const numCols = Math.max(...tableRows.map(r => r.length));
        if (numCols === 0) return;

        const colWidth = printableWidth / numCols;

        tableRows.forEach((row, rowIndex) => {
          const isHeader = rowIndex === 0;

          // Calculate dynamic row height based on cell text wrapping
          let maxCellHeight = 22;
          row.forEach((cell) => {
            const cellText = cleanMarkdownFormatting(cell);
            applyFont(cellText, isHeader, 8.5);
            const h = doc.heightOfString(cellText, { width: colWidth - 10 });
            if (h + 12 > maxCellHeight) {
              maxCellHeight = h + 12;
            }
          });

          checkPageBreak(maxCellHeight + 4);

          const bg = isHeader ? themePrimary : (rowIndex % 2 === 0 ? '#ffffff' : (isBnEdition ? '#f0fdf4' : '#f8fafc'));
          const textColor = isHeader ? '#ffffff' : '#334155';
          const tableY = doc.y;

          row.forEach((cell, colIndex) => {
            const cellX = leftMargin + colIndex * colWidth;
            doc.rect(cellX, tableY, colWidth, maxCellHeight).fillAndStroke(bg, themeBorder);
            
            const cellText = cleanMarkdownFormatting(cell);
            applyFont(cellText, isHeader, 8.5);
            doc.fillColor(textColor)
               .text(cellText, cellX + 5, tableY + 6, { width: colWidth - 10, lineGap: 2 });
          });

          doc.y = tableY + maxCellHeight;
        });

        doc.y += 10;
        tableRows = [];
        inTable = false;
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check if table row
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          inTable = true;
          if (trimmed.match(/^\|[\s:-|-]+\|$/)) {
            continue;
          }
          const cells = trimmed.substring(1, trimmed.length - 1).split('|').map(c => c.trim());
          tableRows.push(cells);
          continue;
        } else if (inTable) {
          flushTable();
        }

        if (trimmed === '') {
          doc.y += 6;
          continue;
        }

        // Headers
        if (trimmed.startsWith('# ')) {
          checkPageBreak(50);
          const headerText = cleanMarkdownFormatting(trimmed);
          doc.roundedRect(leftMargin, doc.y, printableWidth, 28, 4).fill(themePrimary);
          applyFont(headerText, true, 13);
          doc.fillColor('#ffffff').text(headerText, leftMargin + 12, doc.y - 21);
          doc.y += 15;
        } else if (trimmed.startsWith('## ')) {
          checkPageBreak(40);
          const headerText = cleanMarkdownFormatting(trimmed);
          
          doc.rect(leftMargin, doc.y, 4, 18).fill(themeAccent);
          applyFont(headerText, true, 12);
          doc.fillColor(themePrimary).text(headerText, leftMargin + 12, doc.y - 16);
          doc.strokeColor(themeBorder).lineWidth(0.5).moveTo(leftMargin, doc.y + 4).lineTo(leftMargin + printableWidth, doc.y + 4).stroke();
          doc.y += 12;
        } else if (trimmed.startsWith('### ')) {
          checkPageBreak(30);
          const headerText = cleanMarkdownFormatting(trimmed);
          applyFont(headerText, true, 10.5);
          doc.fillColor(themePrimary).text(headerText, leftMargin, doc.y);
          doc.y += 4;
        } 
        // Special Callout / Box
        else if (trimmed.startsWith('>') || trimmed.includes('IMPORTANT') || trimmed.includes('SMART TRICK') || trimmed.includes('MEMORY TRICK') || trimmed.includes('SHORTCUT') || trimmed.includes('COMMON MISTAKE') || trimmed.includes('EXAM FOCUS') || trimmed.includes('FUNNY MEMORY') || trimmed.includes('গুরুত্বপূর্ণ') || trimmed.includes('ট্রিক')) {
          
          let bg = isBnEdition ? '#f0fdf4' : '#f8fafc';
          let border = isBnEdition ? '#86efac' : '#cbd5e1';
          let titleColor = isBnEdition ? '#166534' : '#334155';
          let boxTitle = isBnEdition ? 'গুরুত্বপূর্ণ নোট (KEY NOTE)' : 'KEY NOTE';

          if (trimmed.includes('IMPORTANT') || trimmed.includes('গুরুত্বপূর্ণ')) {
            bg = '#fffbeb'; border = '#f59e0b'; titleColor = '#b45309'; boxTitle = isBnEdition ? '⭐ গুরুত্বপূর্ণ পয়েন্ট (IMPORTANT POINT)' : '⭐ IMPORTANT POINT';
          } else if (trimmed.includes('SMART TRICK') || trimmed.includes('স্মার্ট ট্রিক') || trimmed.includes('TRICK')) {
            bg = '#f0fdf4'; border = '#22c55e'; titleColor = '#15803d'; boxTitle = isBnEdition ? '💡 স্মার্ট ট্রিক (SMART TRICK)' : '💡 SMART TRICK';
          } else if (trimmed.includes('MEMORY') || trimmed.includes('FUNNY') || trimmed.includes('স্মৃতিসহায়ক')) {
            bg = '#faf5ff'; border = '#a855f7'; titleColor = '#7e22ce'; boxTitle = isBnEdition ? '🧠 মেমোরি ট্রিক ও স্মৃতিসহায়ক (MEMORY TRICK & MNEMONIC)' : '🧠 MEMORY TRICK & MNEMONIC';
          } else if (trimmed.includes('SHORTCUT') || trimmed.includes('শর্টকাট')) {
            bg = '#ecfdf5'; border = '#10b981'; titleColor = '#047857'; boxTitle = isBnEdition ? '⚡ পরীক্ষার শর্টকাট (EXAM SHORTCUT)' : '⚡ EXAM SHORTCUT';
          } else if (trimmed.includes('MISTAKE') || trimmed.includes('সতর্কতা')) {
            bg = '#fef2f2'; border = '#ef4444'; titleColor = '#b91c1c'; boxTitle = isBnEdition ? '🚨 সাধারণ ভুলের সতর্কতা (COMMON MISTAKE ALERT)' : '🚨 COMMON MISTAKE ALERT';
          } else if (trimmed.includes('EXAM FOCUS') || trimmed.includes('TREND') || trimmed.includes('ট্রেন্ড')) {
            bg = '#fff7ed'; border = '#f97316'; titleColor = '#c2410c'; boxTitle = isBnEdition ? '🎯 পরীক্ষার ট্রেন্ড ও ফোকাস (EXAM TREND & FOCUS)' : '🎯 EXAM TREND & FOCUS';
          } else if (trimmed.includes('REVISION') || trimmed.includes('রিভিশন')) {
            bg = '#f0fdf4'; border = '#16a34a'; titleColor = '#14532d'; boxTitle = isBnEdition ? '✅ দ্রুত রিভিশন (QUICK REVISION)' : '✅ QUICK REVISION';
          }

          const rawBoxContent = cleanMarkdownFormatting(trimmed);
          
          applyFont(rawBoxContent, false, 9);
          const textHeight = doc.heightOfString(rawBoxContent, { width: printableWidth - 24 });
          const boxHeight = textHeight + 26;

          checkPageBreak(boxHeight + 10);

          const boxStartY = doc.y;
          doc.roundedRect(leftMargin, boxStartY, printableWidth, boxHeight, 6).fillAndStroke(bg, border);
          
          applyFont(boxTitle, true, 9);
          doc.fillColor(titleColor).text(boxTitle, leftMargin + 12, boxStartY + 7);
          
          applyFont(rawBoxContent, false, 9);
          doc.fillColor('#1e293b').text(rawBoxContent, leftMargin + 12, boxStartY + 20, { width: printableWidth - 24, lineGap: 2 });

          doc.y = boxStartY + boxHeight + 8;
        }
        // Bullet list items
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ') || trimmed.startsWith('✓ ')) {
          const itemText = cleanMarkdownFormatting(trimmed);
          applyFont(itemText, false, 9.5);
          const itemHeight = doc.heightOfString(itemText, { width: printableWidth - 18 });
          checkPageBreak(itemHeight + 4);

          const itemY = doc.y;
          applyFont('•', true, 9);
          doc.fillColor(themeAccent).text('•', leftMargin + 5, itemY);

          applyFont(itemText, false, 9.5);
          doc.fillColor('#334155').text(itemText, leftMargin + 18, itemY, { width: printableWidth - 18, lineGap: 2 });
          doc.y += 3;
        } 
        // Numbered items
        else if (trimmed.match(/^\d+\.\s/)) {
          const match = trimmed.match(/^(\d+\.)\s*(.*)/);
          if (match) {
            const num = match[1];
            const text = cleanMarkdownFormatting(match[2]);
            applyFont(text, false, 9.5);
            const itemHeight = doc.heightOfString(text, { width: printableWidth - 24 });
            checkPageBreak(itemHeight + 4);

            const itemY = doc.y;
            applyFont(num, true, 9.5);
            doc.fillColor(themePrimary).text(num, leftMargin + 5, itemY);

            applyFont(text, false, 9.5);
            doc.fillColor('#334155').text(text, leftMargin + 24, itemY, { width: printableWidth - 24, lineGap: 2 });
            doc.y += 3;
          }
        } 
        // Standard Paragraph
        else {
          const cleanPara = cleanMarkdownFormatting(trimmed);
          if (cleanPara) {
            applyFont(cleanPara, false, 9.5);
            const paraHeight = doc.heightOfString(cleanPara, { width: printableWidth });
            checkPageBreak(paraHeight + 4);

            doc.fillColor('#334155').text(cleanPara, leftMargin, doc.y, { width: printableWidth, align: 'left', lineGap: 2 });
            doc.y += 4;
          }
        }
      }

      if (inTable) flushTable();

      // Header & Footer on Pages 2 to End
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      // PRE-EXPORT QUALITY CHECK: Minimum Page Count
      if (totalPages < 2) {
        return reject(new Error("STRICT PDF QUALITY CONTROL FAILURE: Document has fewer than 2 pages. Book formatting required."));
      }

      for (let i = range.start + 1; i < range.start + totalPages; i++) {
        doc.switchToPage(i);

        // Running Header (Page 2+)
        const runningHeaderTag = isBnEdition 
          ? 'MISSIONGRID SMART STUDY BOOK • BENGALI EDITION (বাংলা সংস্করণ)' 
          : 'MISSIONGRID SMART STUDY BOOK • ENGLISH EDITION';
        applyFont(runningHeaderTag, true, 8);
        doc.fillColor('#64748b').text(runningHeaderTag, leftMargin, 22);
        
        const headerTopic = cleanMarkdownFormatting(topic || "Study Guide").substring(0, 40);
        applyFont(headerTopic, false, 8);
        doc.fillColor('#94a3b8').text(`Chapter: ${headerTopic}`, leftMargin, 22, { align: 'right', width: printableWidth });
        doc.strokeColor(themeBorder).lineWidth(0.5).moveTo(leftMargin, 33).lineTo(leftMargin + printableWidth, 33).stroke();

        // Running Footer (Page 2+)
        doc.strokeColor(themeBorder).lineWidth(0.5).moveTo(leftMargin, pageHeight - 38).lineTo(leftMargin + printableWidth, pageHeight - 38).stroke();
        
        applyFont('MissionGrid • Learn. Practice. Succeed.', true, 8);
        doc.fillColor('#64748b').text('MissionGrid • Learn. Practice. Succeed.', leftMargin, pageHeight - 30);
        
        applyFont(`Page ${i + 1} of ${totalPages}`, false, 8);
        doc.fillColor('#94a3b8').text(`Page ${i + 1} of ${totalPages}`, leftMargin, pageHeight - 30, { align: 'right', width: printableWidth });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Background runner for Study Material generation jobs.
 * Runs independently without blocking the UI thread.
 * Enforces dual PDF generation when bilingual/both language mode is selected.
 */
export async function startBackgroundStudyJob(jobId: string): Promise<void> {
  const timeStr = () => new Date().toLocaleTimeString();

  const addLog = (job: JobState, msg: string) => {
    const entry = `[${timeStr()}] ${msg}`;
    job.logs.push(entry);
    console.log(`[Job ${jobId}] ${msg}`);
  };

  try {
    let job = await loadJob(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found in store.`);
      return;
    }

    if (job.status === 'cancelled') {
      addLog(job, "Job was cancelled prior to initialization.");
      await saveJob(jobId, job);
      return;
    }

    // Step 1: Initializing
    job.status = 'generating';
    job.percent = 10;
    job.stage = 'Initializing Gemini Model';
    job.etaSeconds = 30;
    addLog(job, `Initialized background study material pipeline for topic "${job.topic}".`);
    await saveJob(jobId, job);

    // Step 2: Source Context Processing
    job = (await loadJob(jobId))!;
    if (job.status === 'cancelled') return;

    job.percent = 20;
    job.stage = 'Processing Context & Materials';
    job.etaSeconds = 25;

    let providedContent = "";
    if (job.uploadQueue && job.uploadQueue.length > 0) {
      addLog(job, `Processing ${job.uploadQueue.length} context upload items...`);
      providedContent = job.uploadQueue.map(item => item.data ? `${item.name}:\n${item.data}` : item.name).join('\n\n');
    }
    await saveJob(jobId, job);

    const langChoice = (job.language || "english").toLowerCase();
    const needsEnglish = langChoice.includes("english") || langChoice.includes("both") || langChoice.includes("bilingual");
    const needsBengali = langChoice.includes("bengali") || langChoice.includes("both") || langChoice.includes("bilingual");

    let englishContent = "";
    let bengaliContent = "";

    const buildPrompt = (targetLang: 'English' | 'Bengali') => `
      You are an expert Academic Mentor, Author, and Curriculum Designer specializing in high-performance educational publication design for competitive exams (SSC, Railway, Banking, State PSC, UPSC).
      
      TASK: Create a professional, publication-ready study guide book chapter for the topic: "${job.topic}".
      TARGET LANGUAGE: ${targetLang === 'Bengali' ? '100% PURE BENGALI EDITION (বাংলা সংস্করণ)' : '100% PURE ENGLISH EDITION'}.
      TONE: ${job.tone || "Exam-Oriented"}.
      DEPTH: ${job.depth || "Detailed"}.

      CRITICAL STRICT LANGUAGE POLICY (NON-NEGOTIABLE):
      ${targetLang === 'English' ? `
      - THIS IS THE ENGLISH EDITION. WRITE 100% OF THE CONTENT IN ENGLISH ONLY.
      - DO NOT INCLUDE ANY BENGALI SCRIPT OR BENGALI PARAGRAPHS.
      - NEVER USE HINDI ANYWHERE IN THE GENERATED CONTENT.
      ` : `
      - THIS IS THE BENGALI EDITION (বাংলা সংস্করণ). WRITE 100% OF THE CONTENT IN PROPER BENGALI UNICODE SCRIPT.
      - TRANSLATE ALL HEADINGS, THEORY, EXPLANATIONS, NOTES, WORKED EXAMPLES, SHORTCUTS, AND PRACTICE QUESTIONS INTO HIGH-QUALITY ACADEMIC BENGALI.
      - DO NOT WRITE ENGLISH PARAGRAPHS OR MIX BENGALI & ENGLISH IN PARAGRAPHS.
      - NEVER USE HINDI ANYWHERE IN THE GENERATED CONTENT.
      `}

      SUBJECT & CURRICULUM SCOPE:
      Support all competitive exam subjects (English Vocabulary, English Grammar, Mathematics, Static GK, Current Affairs, Reasoning, Science, History, Geography, Polity, Economy, Computer, Biology, Physics, Chemistry, Environment, Railway, SSC, Banking, State PSC).
      
      ${providedContent ? `PRIMARY SOURCE MATERIAL: 
      ---
      ${providedContent}
      ---
      Ensure all critical information from this source is preserved and accurately represented.` : 'Use your expert internal knowledge to provide accurate and up-to-date information.'}

      ${job.isEnhanced ? `
      ENHANCEMENT - High-Retention Learning Mode:
      - Use the Feynman Technique: Explain complex concepts in simple, intuitive terms.
      - Include Mnemonics: Create catchy memory aids for lists or complex sequences.
      - Callout Boxes: Use blockquote callout lines (> **⭐ IMPORTANT**: ..., > **💡 SMART TRICK**: ..., > **🧠 MEMORY TRICK**: ..., > **🚨 COMMON MISTAKE**: ...) to highlight key points, warnings, notes, and deep dives.
      - Active Recall: End with 3-5 high-quality "Active Recall" questions to test understanding.
      ` : ''}

      ${job.isNoteMaking ? `
      NOTE-MAKING MODE:
      - Transform the raw content into structured, concise, and highly scanable notes.
      - DO NOT remove any data, technical details, or key information.
      - Use a clear hierarchical bullet system (nested lists).
      - Bold key terms and definitions.
      ` : ''}

      MANDATORY 14-SECTION BOOK CHAPTER STRUCTURE:
      1. # [Clear, Professional Book Chapter Title in ${targetLang}]
      2. ## 1. Learning Objectives (What the student will master)
      3. ## 2. Quick Overview & Chapter Roadmap
      4. ## 3. Main Concepts & Formulas
      5. ## 4. Detailed Explanations & Theory
      6. ## 5. Worked Examples & Applications
      7. ## 6. PYQ Discussion & Exam Trends
      8. ## 7. Shortcuts & Exam Tricks
      9. ## 8. Memory Tricks & Mnemonics
      10. ## 9. Common Mistakes to Avoid
      11. ## 10. Summary & Key Takeaways
      12. ## 11. Practice Questions with Solutions
      13. ## 12. Final One-Page Quick Revision Sheet
      ${job.isFunnyMemoryMode ? `
      14. ## 😂 Funny Memory Mode (Visual & Phonetic Mnemonics)
         [If vocabulary topic: Generate memory cards with Word, Meaning, Funny Trick, Sound Association, Example Sentence in ${targetLang}]` : ''}
      
      CALLOUT BOX SYNTAX FOR PDF STYLING:
      Utilize blockquote syntax for special educational callouts so the PDF renderer can format them as rounded cards:
      - > **⭐ IMPORTANT**: [Key exam rule or formula]
      - > **💡 SMART TRICK**: [Shortcut method]
      - > **🧠 MEMORY TRICK**: [Mnemonic aid]
      - > **⚡ SHORTCUT**: [Time-saving tip]
      - > **📌 REMEMBER**: [Essential point]
      - > **🚨 COMMON MISTAKE**: [Trap to avoid in exams]
      - > **🎯 EXAM FOCUS**: [Targeted exam weightage & trend]
      - > **🔥 PREVIOUS YEAR TREND**: [Past paper analysis]
      - > **📖 EXAMPLE**: [Solved problem]
      - > **✅ FINAL REVISION**: [One-line revision formula]

      FORMATTING RULES:
      - Use standard Markdown only.
      - Ensure the layout is clean, printable, and book-like.
      - Use Markdown tables for comparisons and formulas.
      - Do not include any conversational preamble or post-script. Start directly with the content.
    `;

    // Step 3A: English Generation
    if (needsEnglish) {
      job = (await loadJob(jobId))!;
      if (job.status === 'cancelled') return;

      job.percent = 35;
      job.stage = 'Generating English Edition Book Chapter';
      job.etaSeconds = 20;
      addLog(job, `Calling Gemini AI to synthesize 100% English Edition study guide for "${job.topic}"...`);
      await saveJob(jobId, job);

      const promptEn = buildPrompt('English');
      englishContent = await executeResilientAI(async (ai) => {
        const response = await ai.models.generateContent({
          model: DEFAULT_MODEL,
          contents: [{ role: 'user', parts: [{ text: promptEn }] }]
        });
        return response.text;
      });
    }

    // Step 3B: Bengali Generation
    if (needsBengali) {
      job = (await loadJob(jobId))!;
      if (job.status === 'cancelled') return;

      job.percent = 60;
      job.stage = 'Generating Bengali Edition Book Chapter';
      job.etaSeconds = 15;
      addLog(job, `Calling Gemini AI to synthesize 100% Bengali Edition (বাংলা সংস্করণ) study guide for "${job.topic}"...`);
      await saveJob(jobId, job);

      const promptBn = buildPrompt('Bengali');
      bengaliContent = await executeResilientAI(async (ai) => {
        const response = await ai.models.generateContent({
          model: DEFAULT_MODEL,
          contents: [{ role: 'user', parts: [{ text: promptBn }] }]
        });
        return response.text;
      });
    }

    // Step 4: Render PDF Buffers and Save
    job = (await loadJob(jobId))!;
    if (job.status === 'cancelled') return;

    ensureStorageDir();

    job.percent = 80;
    job.stage = 'Formatting Educational PDF Books (Pre-Export Quality Check)';
    addLog(job, `Typesetting and verifying PDF documents...`);
    await saveJob(jobId, job);

    const safeTopic = (job.topic || "Study_Guide").replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);

    if (needsEnglish && englishContent) {
      const enBuffer = await buildStudyMaterialPdfBuffer(englishContent, job.topic || "Study Material", 'english');
      const enPath = path.join(STORAGE_PDF_DIR, `${jobId}_en.pdf`);
      fs.writeFileSync(enPath, enBuffer);
      if (!needsBengali) {
        fs.writeFileSync(getStudyPdfPath(jobId), enBuffer);
      }

      job.generatedContent = englishContent;
      job.pdfUrl = `/api/mentor/study-jobs/${jobId}/pdf?lang=en`;
      job.pdfFilename = `${safeTopic}_English_Edition_MissionGrid.pdf`;
      job.pdfSize = `${(enBuffer.length / (1024 * 1024)).toFixed(2)} MB`;
      addLog(job, `📘 English Edition PDF built & verified (${job.pdfSize}).`);
    }

    if (needsBengali && bengaliContent) {
      const bnBuffer = await buildStudyMaterialPdfBuffer(bengaliContent, job.topic || "Study Material", 'bengali');
      const bnPath = path.join(STORAGE_PDF_DIR, `${jobId}_bn.pdf`);
      fs.writeFileSync(bnPath, bnBuffer);
      if (!needsEnglish) {
        fs.writeFileSync(getStudyPdfPath(jobId), bnBuffer);
        job.pdfUrl = `/api/mentor/study-jobs/${jobId}/pdf?lang=bn`;
        job.pdfFilename = `${safeTopic}_Bengali_Edition_MissionGrid.pdf`;
        job.pdfSize = `${(bnBuffer.length / (1024 * 1024)).toFixed(2)} MB`;
      }

      job.generatedContentBn = bengaliContent;
      job.pdfUrlBn = `/api/mentor/study-jobs/${jobId}/pdf?lang=bn`;
      job.pdfFilenameBn = `${safeTopic}_Bengali_Edition_MissionGrid.pdf`;
      job.pdfSizeBn = `${(bnBuffer.length / (1024 * 1024)).toFixed(2)} MB`;
      addLog(job, `📗 Bengali Edition PDF built & verified (${job.pdfSizeBn}).`);
    }

    // Default primary file sync if both exist
    if (needsEnglish && needsBengali) {
      const defaultPath = getStudyPdfPath(jobId);
      const enPath = path.join(STORAGE_PDF_DIR, `${jobId}_en.pdf`);
      if (fs.existsSync(enPath)) {
        fs.copyFileSync(enPath, defaultPath);
      }
    }

    job.percent = 100;
    job.status = 'completed';
    job.stage = 'Completed';
    job.etaSeconds = 0;
    job.completedAt = new Date().toISOString();
    
    addLog(job, `🎉 Background PDF generation complete! Downloads ready for ${needsEnglish && needsBengali ? '📘 English Edition & 📗 Bengali Edition' : needsBengali ? '📗 Bengali Edition' : '📘 English Edition'}.`);
    await saveJob(jobId, job);

    accountAICost(0.5);

  } catch (err: any) {
    console.error(`Error in study material job ${jobId}:`, err);
    const job = await loadJob(jobId);
    if (job) {
      job.status = 'failed';
      job.error = err.message || 'Failed to generate study material PDF.';
      job.stage = 'Failed';
      job.percent = 100;
      job.logs.push(`[${timeStr()}] ❌ Error: ${job.error}`);
      await saveJob(jobId, job);
    }
  }
}
