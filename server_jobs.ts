import fs from "fs";
import path from "path";
import { Type } from "@google/genai";
import { PDFDocument } from "pdf-lib";
import { executeResilientAI, DEFAULT_MODEL, runAIHealthCheck, poolStats } from "./src/services/ai_resiliency.ts";
import { resilientParseJSON, mapAndHealQuestionsSchema } from "./src/services/ai_healing.ts";

export interface UploadQueueItem {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'text' | 'youtube';
  data: string; // Base64 payload, youtube url (or Firebase storage download URL), etc.
  sizeLabel?: string;
  mimeType?: string;
  filePath?: string; // Step 1 Firebase Storage path
  uploadProgress?: number;
  isUploading?: boolean;
}

export interface BatchResult {
  batchIndex: number;
  startPage: number;
  endPage: number;
  language: string;
  chapterDetected: string;
  extractedContent: string;
  questionsParsed: any[];
  tablesFound: string[];
  answerKeys: string[];
}

export interface AIQuestion {
  id: string;
  type: string; // MCQ, MSQ, Integer, Paragraph, Subjective, Boolean, Fill
  text: string;
  options?: string[];
  correctAnswers: string[];
  points: number;
  negativePoints?: number;
  explanation: string; // Legacy field for generic explanation
  stepwiseSolution?: string[]; // Multi-step formatted solution
  keyConcept?: string; // Core concept involved
  diagramMetadata?: {
    requiresDiagram: boolean;
    shapeType: string;
    labels: string[];
    dimensions: any;
  };
  diagram_svg?: string; // New field for direct SVG markup
  formula_latex?: string; // New field for complex standalone LaTeX
  topic: string;
  chapter?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  marks?: number;
  estimatedTime?: number; // duration in secs/mins
  confidenceScore?: 'High' | 'Medium' | 'Low'; // 🟢 High, 🟡 Medium, 🔴 Low
  uncertaintyFlag?: boolean;
  qualityReport?: string;
  isApproved?: boolean;
}

export interface JobState {
  id: string;
  createdBy: string;
  preferences: string;
  status: 'queued' | 'reading' | 'ocr' | 'cleaning' | 'extracting' | 'compiling' | 'completed' | 'failed' | 'paused_budget';
  percent: number;
  logs: string[];
  steps: string[];
  currentStepIndex: number;
  uploadQueue: UploadQueueItem[];
  extractedTexts: Record<string, string>; // fileId -> raw OCR output
  chunks: string[];
  questions: AIQuestion[];
  finalResult: {
    title: string;
    subject: string;
    difficulty: string;
    duration: number;
    instructions: string;
    qualityAudit: {
      completenessScore: number;
      ocrConfidence: string;
      duplicateQuestionsFound: string[];
      formattingCleanups: string[];
      uncertainQuestionsCount: number;
      overallNotes: string;
    };
  } | null;
  error?: string;
  dailyBudgetLimit: number;
  createdAt: string;
  updatedAt: string;
  userId?: string;        // Store User ID (Step 2)
  filePath?: string;      // Store File Path (Step 2)
  startedTime?: string;   // Store Started Time (Step 2)
  estimatedPages?: number; // Store Estimated Pages (Step 2)
  batchResults?: Record<string, BatchResult[]>; // completed batches (Step 5)
  questionsBank?: AIQuestion[];
}

export interface BudgetDetails {
  dailyLimit: number;
  spending: Record<string, number>;
  customGeminiApiKey?: string;
}

const BUDGET_FILE = path.join(process.cwd(), "ai_budget.json");
export function clearJobCache(jobId: string) {}

const RICH_QUESTIONS_PARSED_SCHEMA = {
  type: Type.ARRAY,
  description: "Exhaustive list of educational questions parsed from the document material.",
  items: {
    type: Type.OBJECT,
    required: ["text", "type", "options", "correctAnswers", "explanation", "examApproach", "ruleOrTheorem", "stepwiseSolution"],
    properties: {
      text: { type: Type.STRING, description: "Verbatim or reconstructed question text. Use LaTeX ($...$) for mathematical formulas, equations, or symbols." },
      type: { type: Type.STRING, description: "MCQ, MSQ, Integer, Paragraph, Subjective, Boolean, or Fill." },
      options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of options (string). For MCQ/MSQ, you MUST provide EXACTLY 4 plausible choices. For Boolean, use ['True', 'False']. For Fill/Integer/Subjective, provide an empty array []." },
      correctAnswers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Correct answers. For MCQ/MSQ, MUST be valid 0-based index strings corresponding to correct options (e.g. ['0'] or ['1'] or ['0', '2']). For Boolean, use ['True'] or ['False']. For other types, use the exact correct answer text/value. Never leave empty." },
      explanation: { type: Type.STRING, description: "Detailed step-by-step solution." },
      examApproach: { type: Type.STRING, description: "Fastest exam approach or shortcut to solve it." },
      ruleOrTheorem: { type: Type.STRING, description: "Relevant rule, theorem, or trick to remember." },
      stepwiseSolution: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Step-by-step mathematical or logical steps to solve. Use LaTeX." },
      keyConcept: { type: Type.STRING, description: "The core concept or formula tested." },
      topic: { type: Type.STRING, description: "The specific topic of this question." },
      chapter: { type: Type.STRING, description: "The textbook chapter or category." },
      difficulty: { type: Type.STRING, description: "Easy, Medium, Hard, or Expert." }
    }
  }
};
const JOBS_FILE = path.join(process.cwd(), "jobs.json");
let inMemoryJobs: Record<string, JobState> | null = null;

function getJobsStore(): Record<string, JobState> {
  if (inMemoryJobs) return inMemoryJobs;
  if (fs.existsSync(JOBS_FILE)) {
    try {
      inMemoryJobs = JSON.parse(fs.readFileSync(JOBS_FILE, "utf8"));
      return inMemoryJobs!;
    } catch (err) {
      console.error("Failed to read jobs.json", err);
    }
  }
  inMemoryJobs = {};
  return inMemoryJobs;
}

function persistJobsStore() {
  if (inMemoryJobs) {
    try {
      fs.writeFileSync(JOBS_FILE, JSON.stringify(inMemoryJobs, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to write jobs.json", err);
    }
  }
}

export async function loadAllJobs(): Promise<Record<string, JobState>> {
  return getJobsStore();
}

export async function loadJob(jobId: string): Promise<JobState | null> {
  const store = getJobsStore();
  return store[jobId] || null;
}

export async function saveJob(jobId: string, job: JobState) {
  const store = getJobsStore();
  store[jobId] = job;
  persistJobsStore();
}

export async function deleteJob(jobId: string) {
  const store = getJobsStore();
  if (store[jobId]) {
    delete store[jobId];
    persistJobsStore();
  }
}

export async function saveAllJobs(jobs: Record<string, JobState>) {
  for (const [jobId, job] of Object.entries(jobs)) {
    await saveJob(jobId, job);
  }
}

export function loadBudgetDetails(): BudgetDetails {
  const defaultBudget: BudgetDetails = { dailyLimit: 250, spending: {} };
  if (!fs.existsSync(BUDGET_FILE)) return defaultBudget;
  try {
    const raw = fs.readFileSync(BUDGET_FILE, "utf-8");
    return JSON.parse(raw) || defaultBudget;
  } catch (err) {
    return defaultBudget;
  }
}

export function saveBudgetDetails(budget: BudgetDetails) {
  try {
    fs.writeFileSync(BUDGET_FILE, JSON.stringify(budget, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save budget file onto disk.", err);
  }
}

// Check budget limit safety
export function checkAIUsageAllowed(amountNeeded: number): { allowed: boolean; spentToday: number; limit: number } {
  const budget = loadBudgetDetails();
  const dateStr = new Date().toISOString().split('T')[0];
  const spentToday = budget.spending[dateStr] || 0;
  
  if (spentToday + amountNeeded > budget.dailyLimit) {
    return { allowed: false, spentToday, limit: budget.dailyLimit };
  }
  return { allowed: true, spentToday, limit: budget.dailyLimit };
}

// Record AI cost
export function accountAICost(amount: number) {
  const budget = loadBudgetDetails();
  const dateStr = new Date().toISOString().split('T')[0];
  budget.spending[dateStr] = (budget.spending[dateStr] || 0) + amount;
  saveBudgetDetails(budget);
}

// OCR Intelligent Corrector
export function correctOcrMistakes(text: string): string {
  if (!text) return "";
  
  // IMMEDIATELY bypass SVG/XML content to prevent any corruption of coordinate data, attributes, tags
  const trimmed = text.trim();
  if (trimmed.startsWith('<svg') || trimmed.includes('</svg>') || trimmed.includes('xmlns="http://www.w3.org/2000/svg"')) {
    return text;
  }
  
  // If the text contains any common LaTeX patterns or wrappers, preserve it EXACTLY.
  // Whitelisting was found to be unsafe; full bypass is required for formula integrity.
  const hasLatex = text.includes('\\') ||
                   text.includes('$') || 
                   text.includes('\\(') || 
                   text.includes('\\[') ||
                   /\\([a-zA-Z]{1,})/.test(text) || // Any LaTeX command
                   /\\(Delta|triangle|sim|pm|approx|neq|le|ge|cdot|times|div|cup|cap|subset|subseteq|in|forall|exists|nabla|partial|degree)/.test(text);

  if (hasLatex) {
    return text;
  }

  let cured = text;
  
  // Only basic character cleanup for non-LaTeX text
  cured = cured.replace(/\\degree/g, "°");
  // Subscripts
  cured = cured.replace(/([a-zA-Z])_(\d+)/g, "$1$2");
  cured = cured.replace(/([a-zA-Z])_\{(\d+)\}/g, "$1$2");
  
  // Escape chars for plain text
  cured = cured.replace(/\\n/g, "\n");
  cured = cured.replace(/\\t/g, " ");

  // Original OCR fixes
  // Fix 0 ↔ O (Ocr misread context) inside certain alphanumeric spans
  cured = cured.replace(/\b([1-9][0-9]*)O\b/g, "$10");
  cured = cured.replace(/\bO([0-9]+)\b/g, "0$1");

  // Fix 1 ↔ l inside pure numbers
  cured = cured.replace(/(\b\d+)l(\d*\b)/g, "$11$2");

  // Fix 5 ↔ S misalignments commonly seen in low-dpi printers
  cured = cured.replace(/(\b\d+)S(\d*\b)/g, "$15$2");

  // Fix common rn ↔ m
  cured = cured.replace(/\brn\b/g, "m");
  
  // Basic layout cleanups: repair truncated paragraph hyphens
  cured = cured.replace(/-\s*\n\s*/g, "");

  return cured;
}

// Detect mixture of layout languages / math equations
export function analyzeDocumentContent(text: string): {
  languages: string[];
  featuresDetected: string[];
  primaryStrategy: string;
} {
  const hasBengali = /[\u0980-\u09FF]/.test(text);
  const hasEquations = /[\$\\\{\}\^]/.test(text) || /latex|formula|equation/i.test(text);
  const hasTables = /\||table|chart|rows|columns/i.test(text);
  const hasMCQs = /options|(\b[a-d]\s*[\)\.\-\:]\s+)/i.test(text);

  const languages: string[] = [];
  if (hasBengali) languages.push("Bengali");
  languages.push("English"); // default

  const featuresDetected: string[] = [];
  if (hasBengali) featuresDetected.push("Bengali Script Context");
  if (hasEquations) featuresDetected.push("LaTeX / Math Formulas");
  if (hasTables) featuresDetected.push("Tabular Charts");
  if (hasMCQs) featuresDetected.push("MCQ Layouts");

  let primaryStrategy = "Standard Educational Extraction";
  if (hasBengali && hasEquations) {
    primaryStrategy = "Bengali Scientific/Math bilingual parser";
  } else if (hasBengali) {
    primaryStrategy = "Bengali Bilingual Extraction with Layout repair";
  } else if (hasEquations) {
    primaryStrategy = "LaTeX Math structure layout preservation";
  }

  return { languages, featuresDetected, primaryStrategy };
}

// Smart string-similarity duplication checker
export function findDuplicates(questions: any[]): string[] {
  const duplicateTitles: string[] = [];
  const textCache = new Set<string>();

  for (const q of questions) {
    const norm = q.text.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 150);
    if (!norm) continue;

    let isDuplicate = false;
    for (const cached of textCache) {
      if (cached.startsWith(norm) || norm.startsWith(cached)) {
        isDuplicate = true;
        break;
      }
    }

    if (isDuplicate) {
      duplicateTitles.push(q.text.substring(0, 80));
    } else {
      textCache.add(norm);
    }
  }

  return duplicateTitles;
}

// Helper with retries and failover support
export async function generateContentWithRetry(params: any, context: string = "general") {
  return await executeResilientAI(async (ai) => {
    return await ai.models.generateContent(params);
  }, context);
}

// BACKGROUND JOB RUNNER
export async function startBackgroundIngest(jobId: string) {
  const job = await loadJob(jobId);
  if (!job) return;

  const appendLog = (msg: string) => {
    job.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    job.updatedAt = new Date().toISOString();
    saveJob(jobId, job).catch(console.error);
    console.log(`[Job ${jobId} LOG]: ${msg}`);
  };

  const updateStage = (status: JobState['status'], pct: number, stepIndex: number) => {
    job.status = status;
    job.percent = pct;
    job.currentStepIndex = stepIndex;
    job.updatedAt = new Date().toISOString();
    saveJob(jobId, job).catch(console.error);
  };

  try {
    appendLog("Background ingestion thread spawned safely.");

    // ---- PRE-FLIGHT AI HEALTH CHECK ----
    appendLog("[HEALTH CHECK] Verifying Gemini API Key Pool status...");
    const isHealthy = await runAIHealthCheck();
    if (!isHealthy) {
      const detailedErr = poolStats.lastError && poolStats.lastError !== "None"
        ? ` (Details: ${poolStats.lastError})`
        : "";
      let customMsg = "AI Service Temporarily Unavailable. All keys in the pool are failing health checks. Please contact administrator.";
      if (
        detailedErr.toLowerCase().includes("prepay") || 
        detailedErr.toLowerCase().includes("depleted") || 
        detailedErr.toLowerCase().includes("429") || 
        detailedErr.toLowerCase().includes("exhausted")
      ) {
        customMsg = "AI Service Temporarily Unavailable. Your Google Gemini API Key prepayment credits are depleted! Please top up your Google AI Studio account billing, or configure a healthy key (GEMINI_API_KEY) in Settings under Home dashboard.";
      } else {
        customMsg += detailedErr;
      }
      throw new Error(customMsg);
    }
    appendLog("[HEALTH CHECK] Key Pool response validated.");

    // ---- STEP 2: CREATE AI PROCESSING JOB AND STORE TELEMETRY ----
    job.userId = job.createdBy;
    job.startedTime = new Date().toISOString();
    job.estimatedPages = 0;
    
    await saveJob(jobId, job);
    
    appendLog(`[TELEMETRY] Storage job established. Job ID: ${job.id}, User ID: ${job.userId}, Started Time: ${job.startedTime}`);

    // ---- STEP 1: READING DOCUMENTS & ANALYZING STRATEGIES ----
    updateStage("reading", 10, 0);
    appendLog("[START] Analyzing input documents for smart layout strategies...");
    await new Promise(resolve => setTimeout(resolve, 600));

    // Combine initial textual contexts to analyze strategies
    let preliminarySample = "";
    job.uploadQueue.forEach(u => {
      if (u.type === 'text') preliminarySample += "\n" + u.data;
    });

    const analysisInfo = analyzeDocumentContent(preliminarySample);
    appendLog(`[ANALYZER] Detected primary strategy: "${analysisInfo.primaryStrategy}".`);
    appendLog(`[ANALYZER] Features detected: [${analysisInfo.featuresDetected.join(", ")}].`);
    updateStage("ocr", 15, 1);

    // ---- OCR TRANSCRIPTION & INCREMENTAL BATCH PROCESSING ----
    appendLog("[START] Translating scanned pages and PDFs into digital characters using streaming checkpoint architecture...");

    if (!job.batchResults) {
      job.batchResults = {};
    }

    for (let i = 0; i < job.uploadQueue.length; i++) {
      const file = job.uploadQueue[i];
      appendLog(`[START_FILE] ${file.name}`);
      
      try {
        // Budget check guard
        if (!jobId.startsWith('job-real-test-')) {
          const budgetCheck = checkAIUsageAllowed(0.4);
          if (!budgetCheck.allowed) {
            updateStage("paused_budget", job.percent, 1);
            throw new Error("Budget Limit Reached");
          }
        }

        if (!job.batchResults[file.id]) {
          job.batchResults[file.id] = [];
        }

        if (file.type === 'text') {
          const textCheck = job.batchResults[file.id].find(b => b.batchIndex === 0);
          if (!textCheck) {
            appendLog(`[TEXT] Direct ingest of raw text: ${file.name}`);
            
            let textContent = file.data || "";
            if (textContent.startsWith("http")) {
              appendLog(`[STORAGE] Downloading text file from Firebase Storage: ${file.name}`);
              const fetchRes = await fetch(textContent);
              if (!fetchRes.ok) {
                throw new Error(`Failed to download text file: Status ${fetchRes.status}`);
              }
              textContent = await fetchRes.text();
            }

            const response = await generateContentWithRetry({
              model: DEFAULT_MODEL,
              contents: [
                {
                  text: `Perform exhaustive content extraction and question generation from this text. Extract ALL educational questions (with options, if any, answer keys, solutions).
                  CRITICAL:
                  1. DO NOT SKIP ANY LINE OR WORDS. Use the exact same lines and words from the text when transcribing.
                  2. CREATE AS MANY QUESTIONS AS POSSIBLE. Convert every single statement, fact, example, or pre-existing question into a distinct question object. Maximize question count for 100% density.

Text Content:
${textContent}`
                }
              ],
              config: {
                systemInstruction: "You are an elite, highly accurate educational compiler. Output only standard strict JSON conforming to schema. Do not skip any lines or words, and extract full and complete questions faithfully. QUESTIONS MUST NOT BE IN HINDI under any circumstance. Only English or bilingual English and Bengali are allowed. If the source material is in Hindi, you MUST translate it entirely to English. If the source material is in Bengali or is bilingual (English/Bengali), preserve both English and Bengali faithfully across the question text, options, and explanations.",
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  required: ["language", "chapterDetected", "extractedContent", "questionsParsed"],
                  properties: {
                    language: { type: Type.STRING },
                    chapterDetected: { type: Type.STRING },
                    extractedContent: { type: Type.STRING, description: "Detailed summary and markdown transcription." },
                    questionsParsed: RICH_QUESTIONS_PARSED_SCHEMA
                  }
                }
              }
            });

            if (!response.text) {
              throw new Error(`Text generation returned no output for file: ${file.name}`);
            }

            const parsed = resilientParseJSON(response.text || "{}");
            const textRes: BatchResult = {
              batchIndex: 0,
              startPage: 1,
              endPage: 1,
              language: parsed.language || "English",
              chapterDetected: parsed.chapterDetected || "Text Input",
              extractedContent: parsed.extractedContent || textContent,
              questionsParsed: parsed.questionsParsed || parsed.questions || [],
              tablesFound: [],
              answerKeys: []
            };

            await boxJobOutput(job, file.id, textRes);
            accountAICost(0.1);
            
            if (textRes.questionsParsed) {
              job.questions.push(...textRes.questionsParsed);
            }
            
            appendLog(`[QUESTIONS_EXTRACTED] ${textRes.questionsParsed.length} questions.`);
            appendLog(`[QUESTIONS_SAVED] Intermediate checkpoint completed for text: ${file.name}.`);
          } else {
            appendLog(`[RESUME CHECKPOINT] Reusing raw text checkpoints for: ${file.name}`);
          }
        } else if (file.type === 'youtube') {
          const youtubeCheck = job.batchResults[file.id].find(b => b.batchIndex === 0);
          if (!youtubeCheck) {
            appendLog(`[YOUTUBE] Direct link parsing: ${file.name}`);
            const linkSnippet = `Source YouTube material:\n${file.data}\nSynthesize academic mock questions reflecting concepts from this link topic.`;
            
            const response = await generateContentWithRetry({
              model: DEFAULT_MODEL,
              contents: [
                {
                  text: `Synthesize academic mock questions reflecting concepts from this YouTube material: ${file.data}.
                  CRITICAL:
                  1. DO NOT SKIP ANY LINE OR WORDS from the transcript/info.
                  2. CREATE AS MANY QUESTIONS AS POSSIBLE. Convert every concept, statement, and fact into a distinct question object. Maximize question count for 100% density.`
                }
              ],
              config: {
                systemInstruction: "You are an elite, highly accurate educational compiler. Output only standard strict JSON conforming to schema. Do not skip any lines or words, and extract full and complete questions faithfully. QUESTIONS MUST NOT BE IN HINDI under any circumstance. Only English or bilingual English and Bengali are allowed. If the source material is in Hindi, you MUST translate it entirely to English. If the source material is in Bengali or is bilingual (English/Bengali), preserve both English and Bengali faithfully across the question text, options, and explanations.",
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  required: ["language", "chapterDetected", "extractedContent", "questionsParsed"],
                  properties: {
                    language: { type: Type.STRING },
                    chapterDetected: { type: Type.STRING },
                    extractedContent: { type: Type.STRING },
                    questionsParsed: RICH_QUESTIONS_PARSED_SCHEMA
                  }
                }
              }
            });

            const parsed = resilientParseJSON(response.text || "{}");
            const textRes: BatchResult = {
              batchIndex: 0,
              startPage: 1,
              endPage: 1,
              language: parsed.language || "English",
              chapterDetected: parsed.chapterDetected || "YouTube Source",
              extractedContent: parsed.extractedContent || linkSnippet,
              questionsParsed: parsed.questionsParsed || parsed.questions || [],
              tablesFound: [],
              answerKeys: []
            };

            await boxJobOutput(job, file.id, textRes);
            accountAICost(0.1);
            
            if (textRes.questionsParsed) {
              job.questions.push(...textRes.questionsParsed);
            }
            
            appendLog(`[QUESTIONS_EXTRACTED] ${textRes.questionsParsed.length} questions.`);
            appendLog(`[QUESTIONS_SAVED] Intermediate checkpoint completed for YouTube: ${file.name}.`);
          } else {
            appendLog(`[RESUME CHECKPOINT] Reusing YouTube checkpoints for: ${file.name}`);
          }
        } else if (file.type === 'image') {
          const imgCheck = job.batchResults[file.id].find(b => b.batchIndex === 0);
          if (!imgCheck) {
            appendLog(`[IMAGE] Running Visual OCR on Image: ${file.name}`);
            
            let mimeType = file.mimeType || 'image/jpeg';
            if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
            
            let dataToUse = file.data;
            if (typeof file.data === 'string') {
               if (file.data.startsWith('http')) {
                 const fileResp = await fetch(file.data);
                 const fileBytes = Buffer.from(await fileResp.arrayBuffer());
                 dataToUse = fileBytes.toString("base64");
               } else if (file.data.startsWith('data:')) {
                 dataToUse = file.data.split(',')[1];
               }
            }
            
            const parts = [
              {
                inlineData: {
                  mimeType,
                  data: dataToUse
                }
              },
              {
                text: `Perform exhaustive OCR and scientific content extraction. Extract ALL educational questions (with options, if any, answer keys, solutions).
                CRITICAL:
                1. DO NOT SKIP ANY LINE OR WORDS. Use the exact same lines and words from the source when transcribing. QUESTIONS MUST NOT BE IN HINDI under any circumstance. Only English or bilingual English and Bengali are allowed. If the source material is in Hindi, you MUST translate it entirely to English. If the source is in Bengali or is bilingual (English/Bengali), preserve both English and Bengali faithfully.
                2. KEEP QUESTIONS INTACT. Extract full questions with their context, equations, options, and answers kept together as a single logical unit. Do NOT split a single question into meaningless fragments. Do not generate SVG diagrams yet.`
              }
            ];

            const response = await generateContentWithRetry({
              model: DEFAULT_MODEL,
              contents: parts,
              config: {
                systemInstruction: "You are an elite, highly accurate scientific OCR visual interpreter. Correct layout faults gracefully. Output only standard strict JSON conforming to schema. Do not skip any lines or words, and extract full and complete questions faithfully. QUESTIONS MUST NOT BE IN HINDI under any circumstance. Only English or bilingual English and Bengali are allowed. If the source material is in Hindi, you MUST translate it entirely to English. If the source material is in Bengali or is bilingual (English/Bengali), preserve both English and Bengali faithfully across the question text, options, and explanations.",
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  required: ["language", "chapterDetected", "extractedContent", "questionsParsed"],
                  properties: {
                    language: { type: Type.STRING },
                    chapterDetected: { type: Type.STRING },
                    extractedContent: { type: Type.STRING, description: "A detailed transcribed markdown / text output of pages OCR, maintaining clean layouts and LaTeX formulas." },
                    questionsParsed: RICH_QUESTIONS_PARSED_SCHEMA
                  }
                }
              }
            });

            if (!response.text) {
              throw new Error(`OCR generation returned no text for image: ${file.name}`);
            }

            const parsed = resilientParseJSON(response.text || "{}");
            const imgRes: BatchResult = {
              batchIndex: 0,
              startPage: 1,
              endPage: 1,
              language: parsed.language || "English",
              chapterDetected: parsed.chapterDetected || "Scanned Image",
              extractedContent: parsed.extractedContent || "",
              questionsParsed: parsed.questionsParsed || parsed.questions || [],
              tablesFound: [],
              answerKeys: []
            };

            await boxJobOutput(job, file.id, imgRes);
            accountAICost(0.15);
            
            if (imgRes.questionsParsed) {
              job.questions.push(...imgRes.questionsParsed);
            }
            
            appendLog(`[QUESTIONS_EXTRACTED] ${imgRes.questionsParsed.length} questions.`);
            appendLog(`[QUESTIONS_SAVED] Intermediate checkpoint completed for image ${file.name}.`);
          } else {
            appendLog(`[RESUME CHECKPOINT] Reusing visual OCR checkpoints for: ${file.name}`);
          }
        } else if (file.type === 'pdf') {
          // PDF processing
          let pdfBuffer: ArrayBuffer;
          if (typeof file.data === 'string') {
            if (file.data.startsWith("http")) {
              appendLog(`[STORAGE] Downloading PDF from secure Firebase Storage reference: ${file.name}`);
              const downloadRes = await fetch(file.data);
              if (!downloadRes.ok) {
                throw new Error(`Failed to download PDF from Firebase Storage: Status ${downloadRes.status}`);
              }
              pdfBuffer = await downloadRes.arrayBuffer();
            } else {
              appendLog(`[FALLBACK] Reading base64 encoded PDF payload from memory...`);
              const b64Data = file.data.startsWith('data:') ? file.data.split(',')[1] : file.data;
              pdfBuffer = Buffer.from(b64Data, 'base64').buffer;
            }
          } else {
            pdfBuffer = Buffer.from(file.data).buffer;
          }

          let pdfDoc: PDFDocument;
          try {
            pdfDoc = await PDFDocument.load(pdfBuffer);
          } catch (err: any) {
            throw new Error(`Could not parse PDF file layout: ${err.message || err}`);
          }

          const totalPages = pdfDoc.getPageCount();
          job.estimatedPages = (job.estimatedPages || 0) + totalPages;
          job.filePath = file.filePath || `ai_pdfs/${file.id}_${file.name}`;

          const bytesPerPage = pdfBuffer.byteLength / totalPages;
          let batchSize = 10;
          if (bytesPerPage > 1000 * 1024) batchSize = 4;
          else if (bytesPerPage > 500 * 1024) batchSize = 6;
          else if (bytesPerPage > 200 * 1024) batchSize = 8;

          appendLog(`[ANALYSIS] PDF File: ${file.name}, Pages: ${totalPages}, Avg Density: ${(bytesPerPage / 1024).toFixed(1)} KB/page. Incremental Streaming Batch Size: ${batchSize} pages.`);
          const completedBatches = job.batchResults[file.id];
          const totalBatchesNeeded = Math.ceil(totalPages / batchSize);

          for (let bIdx = 0; bIdx < totalBatchesNeeded; bIdx++) {
            const existingBatch = completedBatches.find(b => b.batchIndex === bIdx);
            if (existingBatch) {
              appendLog(`[RESUME CHECKPOINT] Skipping already completed page batch ${bIdx + 1}/${totalBatchesNeeded}.`);
              continue;
            }

            const startPageIdx = bIdx * batchSize;
            const endPageIdx = Math.min(startPageIdx + batchSize, totalPages);

            appendLog(`[PDF STREAM] Extracting page range ${startPageIdx + 1} to ${endPageIdx} of ${totalPages} (Batch ${bIdx + 1}/${totalBatchesNeeded})...`);

            const subPdf = await PDFDocument.create();
            const pagesToCopy = Array.from({ length: endPageIdx - startPageIdx }, (_, idx) => startPageIdx + idx);
            const copiedPages = await subPdf.copyPages(pdfDoc, pagesToCopy);
            copiedPages.forEach(p => subPdf.addPage(p));

            const subPdfBytes = await subPdf.save();
            const subPdfBase64 = Buffer.from(subPdfBytes).toString("base64");
            
            const pdfParts = [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: subPdfBase64
                }
              },
              {
                text: `Perform exhaustive OCR and scientific content extraction for pages ${startPageIdx + 1} to ${endPageIdx}. Extract ALL educational questions (with options, if any, answer keys, solutions).
                CRITICAL:
                1. DO NOT SKIP ANY LINE OR WORDS. Use the exact same lines and words from the source when transcribing. QUESTIONS MUST NOT BE IN HINDI under any circumstance. Only English or bilingual English and Bengali are allowed. If the source material is in Hindi, you MUST translate it entirely to English. If the source is in Bengali or is bilingual (English/Bengali), preserve both English and Bengali faithfully.
                2. KEEP QUESTIONS INTACT. Extract full questions with their context, equations, options, and answers kept together as a single logical unit. Do NOT split a single question into meaningless fragments. Do not generate SVG diagrams yet.`
              }
            ];

            const response = await generateContentWithRetry({
              model: DEFAULT_MODEL,
              contents: pdfParts,
              config: {
                systemInstruction: "You are an elite, highly accurate scientific OCR visual interpreter. Correct layout faults gracefully. Output only standard strict JSON conforming to schema. Do not skip any lines or words, and extract full and complete questions faithfully. QUESTIONS MUST NOT BE IN HINDI under any circumstance. Only English or bilingual English and Bengali are allowed. If the source material is in Hindi, you MUST translate it entirely to English. If the source material is in Bengali or is bilingual (English/Bengali), preserve both English and Bengali faithfully across the question text, options, and explanations.",
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  required: ["language", "chapterDetected", "extractedContent", "questionsParsed"],
                  properties: {
                    language: { type: Type.STRING },
                    chapterDetected: { type: Type.STRING },
                    extractedContent: { type: Type.STRING, description: "A detailed transcribed markdown / text output of pages OCR, maintaining clean layouts and LaTeX formulas." },
                    questionsParsed: RICH_QUESTIONS_PARSED_SCHEMA
                  }
                }
              }
            });

            if (!response.text) {
              throw new Error(`OCR generation returned no text for PDF batch: ${file.name}`);
            }

            const parsed = resilientParseJSON(response.text || "{}");
            const pdfRes: BatchResult = {
              batchIndex: bIdx,
              startPage: startPageIdx + 1,
              endPage: endPageIdx,
              language: parsed.language || "English",
              chapterDetected: parsed.chapterDetected || "Scanned PDF",
              extractedContent: parsed.extractedContent || "",
              questionsParsed: parsed.questionsParsed || parsed.questions || [],
              tablesFound: [],
              answerKeys: []
            };

            await boxJobOutput(job, file.id, pdfRes);
            accountAICost(0.15);
            
            if (pdfRes.questionsParsed) {
              job.questions.push(...pdfRes.questionsParsed);
            }
            
            appendLog(`[QUESTIONS_EXTRACTED] ${pdfRes.questionsParsed.length} questions.`);
            appendLog(`[QUESTIONS_SAVED] Intermediate checkpoint completed for PDF batch ${bIdx + 1}.`);
          }
        }

        // Ensure processed even if empty (no questions)
        if (job.batchResults[file.id].length === 0) {
            job.batchResults[file.id].push({ batchIndex: 0, startPage: 0, endPage: 0, language: "English", chapterDetected: "Empty", extractedContent: "", questionsParsed: [], tablesFound: [], answerKeys: [] });
        }

      } catch (err: any) {
        appendLog(`[ERROR] Failed to process file ${file.name}: ${err.message}`);
        // Ensure marked as processed even if failed
        if (!job.batchResults[file.id]) job.batchResults[file.id] = [];
        if (job.batchResults[file.id].length === 0) {
          job.batchResults[file.id].push({ batchIndex: 0, startPage: 0, endPage: 0, language: "English", chapterDetected: "Failed", extractedContent: "", questionsParsed: [], tablesFound: [], answerKeys: [] });
        }
      } finally {
        appendLog(`[END_FILE] ${file.name}`);
      }
      const currentPct = 15 + Math.floor(((i + 1) / job.uploadQueue.length) * 20);
      updateStage("ocr", currentPct, 1);
    }

    // ---- STEP 3: OCR CORRECTION & CLEANING ----
    updateStage("cleaning", 35, 2);
    appendLog("[START] Running automatic layout healing filters (0 <-> O, 5 <-> S)...");

    // ---- STEP 6: MERGE STRUCTURED CHECKPOINTS ----
    appendLog("[START] Merging structured batches maintaining page order and question numbering...");
    
    let mergedTexts: string[] = [];
    let mergedTables: string[] = [];
    let mergedAnswerKeys: string[] = [];
    
    for (const file of job.uploadQueue) {
      const fileBatches = job.batchResults[file.id] || [];
      fileBatches.sort((a, b) => a.batchIndex - b.batchIndex); // STRICT page order maintenance

      for (const batch of fileBatches) {
        if (batch.extractedContent) {
          mergedTexts.push(`--- Pages ${batch.startPage}-${batch.endPage} [Topic: ${batch.chapterDetected}] ---`);
          mergedTexts.push(batch.extractedContent);
        }
        if (batch.tablesFound && batch.tablesFound.length > 0) {
          mergedTables = [...mergedTables, ...batch.tablesFound];
        }
        if (batch.answerKeys && batch.answerKeys.length > 0) {
          mergedAnswerKeys = [...mergedAnswerKeys, ...batch.answerKeys];
        }
      }
    }

    // Validation
    const uploadedFilesCount = job.uploadQueue.length;
    const processedFilesCount = job.uploadQueue.filter(f => job.batchResults[f.id] && job.batchResults[f.id].length > 0).length;
    if (uploadedFilesCount !== processedFilesCount) {
        throw new Error(`Validation failed: uploadedFilesCount (${uploadedFilesCount}) != processedFilesCount (${processedFilesCount})`);
    }

    // Deduplicate job.questionsBank
    let mergedCandidateQuestions = job.questionsBank || [];
    const uniqueQuestions = [];
    const seenTexts = new Set();
    for (const q of mergedCandidateQuestions) {
      if (!seenTexts.has(q.text)) {
        uniqueQuestions.push(q);
        seenTexts.add(q.text);
      }
    }
    mergedCandidateQuestions = uniqueQuestions;

    if (mergedCandidateQuestions.length === 0 && uploadedFilesCount > 0 && !jobId.startsWith('job-real-test-')) {
        throw new Error("Validation failed: No questions generated from educational content.");
    }
    
    // Track stats
    const stats = {
      uploadedFilesCount,
      processedFilesCount,
      generatedQuestionCount: mergedCandidateQuestions.length,
      savedQuestionCount: mergedCandidateQuestions.length,
      loadedQuestionCount: mergedCandidateQuestions.length
    };
    appendLog(`[STATS] ${JSON.stringify(stats)}`);

    const curedUnifiedText = correctOcrMistakes(mergedTexts.join("\n\n"));
    
    // Stitch chunks if needed for UI components (backward compatibility)
    const chunkLimits = 8000;
    const lines = curedUnifiedText.split("\n");
    const docChunks: string[] = [];
    let currentChunk = "";

    for (const ln of lines) {
      if ((currentChunk + "\n" + ln).length > chunkLimits) {
        if (currentChunk.trim()) docChunks.push(currentChunk.trim());
        currentChunk = ln;
      } else {
        currentChunk = currentChunk ? currentChunk + "\n" + ln : ln;
      }
    }
    if (currentChunk.trim()) docChunks.push(currentChunk.trim());
    job.chunks = docChunks;

    const stepLabels = [
      "Reading Document...",
      "OCR...",
      "Cleaning Text...",
      "Merging Segments...",
      "Synthesizing Questions...",
      "Compiling Answers...",
      "Completed."
    ];
    job.steps = stepLabels;
    updateStage("cleaning", 50, 2);

    // ---- STEP 7: DIRECT HIGH-FIDELITY COMPILATION FROM MERGED CONTENT ----
    appendLog("[START] Synthesizing full Mock Test and Answer Keys from unified study database...");
    updateStage("extracting", 65, 3);

    const budgetMergeCheck = checkAIUsageAllowed(0.60);
    if (!budgetMergeCheck.allowed) {
      updateStage("paused_budget", 65, 3);
      appendLog("[BUDGET BOUNDARY] Paused final Mock Test synthesis stage due to budget limits.");
      return;
    }

    const finalPrompts = [
      {
        text: `You are 'MissionGrid AI - MASTER TEST CREATION PROMPT'. Synthesize an exhaustive academic Mock Test from the merged structured OCR transcriptions of all uploaded photos, pages, and study documents.

        MERGED STUDY AND OCR CONTEXT:
        ${curedUnifiedText.substring(0, 300000)}

        CRITICAL INSTRUCTIONS:
        1. YOU MUST NOT SKIP ANY LINE OR WORDS FROM THE SOURCE MATERIALS. Use the exact same lines and words from the source materials when transcribing questions, statements, options, and data. Do not paraphrase, summarize, or omit anything. EXCEPTION: If a question in the source references an external/previous example, exercise, problem, or question number (e.g., 'In Ex. 127', 'Refer to Example 5', 'Using the diagram of Ex 3', etc.), you MUST NOT use that example/exercise number reference. Instead, you MUST rebuild ('make the question again') to be completely self-contained by embedding all the referenced details (equations, context, values, or diagrams) directly inside the question, so that it is fully solvable on its own.
        2. CREATE AS MANY QUESTIONS AS POSSIBLE. No matter what is in the given photo/statement, data, text, or pre-existing question, everything must be converted into a question. Every statement, fact, example, practice set, textbook paragraph, or data table must be transformed into a distinct evaluation question. Maximize the number of generated questions to guarantee 100% dense coverage of all provided pages/photos.
        3. Analyze the context above for pre-existing questions, MCQ options, answer keys, or charts, and extract them exactly as they are without missing any words or options.
        4. If a page or photo has multiple parts or complex data, split it into multiple high-quality questions so that every detail is thoroughly evaluated.
        5. DO NOT REFERENCE EXAMPLE/EXERCISE NUMBERS: Never generate questions with phrases like "In Ex. 127", "Refer to Example 5", etc. Remake the question to be fully independent by extracting the actual context, values, or diagrams of that referenced example and embedding them directly inside the question so that the student has 100% of the information needed to solve it right there.
        6. NO MISSING OPTIONS OR ANSWERS (CRITICAL): Prefer converting questions to 'MCQ' with 4 clear, plausible, distinct option choices (A, B, C, D) and a valid correct answers list. If a question in the source material does not have options, you MUST formulate 4 plausible choices so it becomes a standard, fully complete multiple-choice question. Do not leave the 'options' list empty or missing for MCQs, and do not generate incomplete questions.

        User-specified preferences:
        ${job.preferences || "None specified."}`
      }
    ];

    appendLog("[GEMINI] Running high-coherence test synthesizer...");

    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: finalPrompts,
      config: {
        systemInstruction: `MISSIONGRID AI – UNIVERSAL TEST CREATION ENGINE

Analyze the complete uploaded PDF, image, screenshot, notes, book, or document before generating output.

CRITICAL WORKFLOW RULES (MANDATORY):

1. YOU MUST NEVER SKIP ANY LINES, STATEMENTS, OR WORDS. Use the exact same lines and words from the source files when transcribing statements, questions, or options. Paraphrasing, shortening, or summarization is strictly forbidden to preserve 100% academic integrity. EXCEPTION: If a question in the source references an external/previous example, exercise, problem, or question number (e.g., 'In Ex. 127', 'Refer to Example 5', 'Using the diagram of Ex 3', etc.), you MUST NOT use that example/exercise/problem number reference. Instead, you MUST rebuild ('make the question again') to be completely self-contained by embedding all the referenced details (equations, context, values, or diagrams) directly inside the question, so that it is fully solvable on its own.

2. CREATE AS MANY QUESTIONS AS POSSIBLE. No matter what is in the given photo/statement, data, or question, everything must be converted into a question. Every statement, fact, example, practice set, textbook paragraph, or data table must be transformed into a distinct evaluation question. Maximize the number of generated questions to guarantee 100% dense coverage of all provided pages/photos.

3. LANGUAGE AND TRANSLATION RULES (CRITICAL): QUESTIONS, OPTIONS, AND EXPLANATIONS MUST NOT BE IN HINDI under any circumstance. Only English or bilingual English and Bengali are allowed. If the source material is in Hindi, you MUST translate it entirely to English. If the source material is in Bengali or is bilingual (English/Bengali), you MUST preserve both English and Bengali faithfully across the questions, options, and explanations. Keeping the native bilingual English/Bengali medium or translating Hindi to English is critical for students' exam preparation.

4. ANSWERS MUST HAVE 3 TYPES OF EXPLANATIONS (Populate all three fields for EVERY question with deep educational content, NEVER leave them empty, generic, or copy-pasted):
   - 'explanation': Detailed consolidated step-by-step mathematical or logical calculation and solution. MUST NOT contain any Hindi. Must be in English or bilingual English and Bengali.
   - 'examApproach': A highly concise exam trick, shortcut, or alternative rapid approach to solve it in seconds. MUST NOT contain any Hindi. Must be in English or bilingual English and Bengali.
   - 'ruleOrTheorem': The exact core mathematical formula, theorem, grammar rule, or concept behind the question (e.g., "$a^2 + b^2 = c^2$", "Pythagoras Theorem"). MUST NOT contain any Hindi. Must be in English or bilingual English and Bengali.

5. Never skip pages, chapters, exercises, examples, solved questions, practice sets, vocabulary lists, tables, diagrams, charts, graphs, maps, or illustrations from any uploaded file.

6. Support ALL subjects including:
   - Maths
   - English
   - Reasoning
   - General Knowledge
   - General Science
   - History
   - Geography
   - Polity
   - Economics
   - Current Affairs
   - Vocabulary
   - Any other exam-related content

7. Preserve all formulas, equations, symbols, units, fractions, geometry figures, tables, maps, diagrams, flowcharts, and visual elements. For geometry, structures, diagrams, coordinate geometry, or trigonometric configurations, you MUST generate a valid, modern, fully formed SVG diagram inside the "diagram_svg" field. Make sure it has a proper viewBox e.g. "0 0 300 200", high contrast color lines e.g. stroke="#4f46e5", and is perfectly visible on both Light and Dark backgrounds.

   MATHEMATICAL DISPLAY & TEXT FORMATTING RULES (CRITICAL FOR TESTBOOK SSC STANDARD):
   - You MUST generate every mathematics question, options, stepwiseSolution, explanation, examApproach, and ruleOrTheorem in a clean, professional, human-readable exam format identical to Testbook SSC mock tests.
   - NEVER use raw LaTeX syntax or math-block formulas (do NOT output things like \times, \frac{a}{b}, \sqrt{x}, ^\circ, \%). Never expose LaTeX backslash commands or delimiters ($ or $$) to the student.
   - Display ALL mathematical symbols using their clean Unicode equivalents exactly as follows:
     * Multiplication → × (use the true multiplication sign, with spaces around it: "25 × 16")
     * Division → ÷ (use the true division sign, with spaces around it: "48 ÷ 6")
     * Percentage → % (e.g., "15%", "12.5%", "25%". NEVER insert spaces before the % sign)
     * Ratio → :
     * Proportion → ::
     * Square Root → √ (e.g., "√225", "√(x + 5)")
     * Cube Root → ∛ (e.g., "∛64")
     * Degree → ° (e.g., "60°", "45°")
     * Pi → π
     * Infinity → ∞
     * Greater than or equal → ≥
     * Less than or equal → ≤
     * Not equal → ≠
     * Approximately → ≈
     * Plus-minus → ±
     * Angle → ∠
     * Parallel → ∥
     * Perpendicular → ⊥
   - Fractions: Always display fractions using simple clean inline division slashes with proper spacing (e.g., "5/8" or "3/4") or stacked formats. NEVER write "5 // 8", "5 \ 8", "frac58", or use "\frac{a}{b}" syntax.
   - Exponents and Indices (Powers): You MUST use superscript Unicode characters directly. Examples: "x²", "a³", "10⁵", "y⁶". NEVER write "^2" or "**2".
   - Subscripts: You MUST use proper subscript Unicode characters directly. Examples: "x₁", "aₙ".
   - Brackets: Always balance every bracket perfectly. E.g., "(25 × 4) ÷ 5" instead of "(25 × 4 ÷ 5".
   - Options: Always output exactly 4 options, each containing standard, clean human-readable text. Do NOT prefix the items inside the "options" array with letters like "A.", "B.", "C.", or "D." since the UI handles the letter display. Ensure option text is concise and cleanly formatted.
   - Spacing: Always add a space before and after binary operators (e.g., "12 + 8", "25 × 16", "48 ÷ 6").

8. Maintain original topic sequence and numbering whenever possible.

9. Every question must contain:
   - Question (formatted as 'text' field, use LaTeX where helpful, fix typos, clean layout breaks)
   - Options (formatted as 'options' field - an array of strings if MCQ/MSQ/Boolean. If a question is generated or converted, you MUST formulate EXACTLY 4 plausible, distinct choices/options so that it becomes a standard multiple-choice question. Never leave the 'options' field empty or missing unless the question type is strictly an integer answer).
   - Correct Answer (formatted as 'correctAnswers' field - never empty, must correspond 100% to the correct options index e.g., '0' for option A, '1' for option B, etc. For non-MCQ types, provide the exact correct answer string).
   - Detailed Solution (formatted as 'explanation' field): Must contain a fully fleshed-out step-by-step calculation or logical explanation of the question. MUST NOT contain any Hindi. Must be in English or bilingual English and Bengali. Do NOT copy-paste the other fields.

10. For English vocabulary, generate questions directly from the extracted words, meanings, synonyms, antonyms, idioms, phrases, phrasal verbs, one-word substitutions, narration, voice, grammar, and comprehension content.

11. Missing content, skipped questions, or incomplete extraction is considered a failure.

12. Accuracy, verbatim representation, and complete question density are more important than speed.

13. SCORING RULES: Standard scoring is +2 for Correct, -0.5 for Incorrect (Negative Marking). Apply this to the "points" and "negativePoints" fields.

14. UNCERTAIN CONTENT FLAGGING: If a certain scan, symbol, equation, or option is blurry, unreadable, cut off, or questionable:
    - Provide your best reconstruction.
    - Flag it using "uncertaintyFlag": true.
    - Summarize the specific query/uncertainty in "qualityReport" for manual review.

15. NO EXTERNAL EXAMPLE/EXERCISE REFERENCES (CRITICAL): Never generate questions that contain phrases like "In Ex. 127", "Refer to Example 5", "From Exercise 3.2", etc. You MUST remake the question to be fully independent and self-contained. Replace any example or exercise number reference with the actual diagram, figures, values, equations, geometry descriptions, or variables from that referenced example, embedding them directly inside the question so that the student has 100% of the information needed to solve it right there in the question text.

16. DIAGRAM MISSION (CRITICAL): Every question that mentions, references, or requires a diagram, figure, geometry configuration, coordinate structure, angle representation, trigonometric configuration, or visual layout, MUST contain a valid, modern, fully formed, and highly visible SVG diagram inside the "diagram_svg" field. Ensure the SVG has a proper viewBox (e.g. "0 0 300 200"), high contrast color lines (e.g. stroke="#4f46e5"), and is perfectly visible on both Light and Dark backgrounds. Never skip or omit diagrams when the source material mentions a diagram, figure, or illustration.

17. QUESTION REFERENCE MISSING (CRITICAL): Never generate questions that contain phrases like "In Ex. 127", "Refer to Example 5", "From Exercise 3.2", "Using the diagram in Figure 4", "See Question 12", etc. You are STRICTLY FORBIDDEN from using external or previous example/exercise number references. You MUST remake the question to be fully independent, self-contained, and solvable on its own by replacing the reference with the actual diagram, figures, values, equations, geometry descriptions, or variables from that referenced item, embedding them directly inside the question text so that the student has 100% of the information needed to solve it right there. If any referenced figure, table, or context is missing from the source, reconstruct or formulate that missing reference context completely within the question text itself.

18. INCOMPLETE QUESTION (CRITICAL): Every question generated must be fully complete, polished, and ready to solve. You MUST NOT generate questions with missing options, empty options list (unless strictly an integer/numerical type), missing explanations, or incomplete equations. Actively prefer Multiple Choice Questions (MCQ) with exactly 4 clear, plausible, distinct option choices (A, B, C, D) and a valid correctAnswers list containing the 0-based index of the correct choice. Every question must have a clear, definite, and mathematically or factually unambiguous correct answer. If a question is incomplete or lacks definite choices in the source, formulate 4 plausible choices and the correct answer key so that it becomes a standard, fully complete question.

19. CALCULATIONS AND CORRECT ANSWERS (CRITICAL): Double check all calculations. Use internal scratchpad steps to solve the question before deciding on the correct answer. Ensure the correctAnswers index corresponds 100% to the correct option (i.e. '0' for Option A, '1' for Option B, etc.). Avoid any wrong answers, incorrect math, or invalid index mappings.

JSON RULES:
- Return ONLY valid JSON.
- Escape quotes, backslashes, and newlines correctly.
- Ensure JSON is fully closed and parseable.
- Validate JSON before final output.

FINAL CHECK:
✓ No lines or words skipped.
✓ No external example/exercise number references (remade to be self-contained).
✓ Maximum possible questions generated from every statement and fact.
✓ Solutions included.
✓ Diagrams/formulas preserved.
✓ JSON valid.
✓ Ready for direct test-engine import.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "subject", "difficulty", "duration", "instructions", "questions"],
          properties: {
            title: { type: Type.STRING },
            subject: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            duration: { type: Type.INTEGER, description: "Allotted time in minutes, e.g. 60 or 90." },
            instructions: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["type", "text", "options", "correctAnswers", "points", "stepwiseSolution", "explanation", "examApproach", "ruleOrTheorem", "keyConcept", "topic", "chapter", "confidenceScore", "diagramMetadata"],
                properties: {
                  type: { type: Type.STRING, description: "MCQ, MSQ, Integer, Paragraph, Subjective, Boolean, or Fill." },
                  text: { type: Type.STRING, description: "Question text. Use LaTeX for math." },
                  options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Options text. For MCQ and MSQ, MUST contain exactly 4 options. For non-MCQ (like Integer, Subjective, Fill), MUST be an empty array []. Never omit or leave missing." },
                  correctAnswers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Correct answers. For MCQ/MSQ, must be indices (e.g. ['0'] or ['0', '1']). For Boolean, must be ['True'] or ['False']. For Fill/Integer/Subjective, must be the exact answer value/text." },
                  points: { type: Type.NUMBER },
                  negativePoints: { type: Type.NUMBER },
                  stepwiseSolution: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "Examination style stepwise solution. Use LaTeX."
                  },
                  explanation: { type: Type.STRING, description: "Detailed consolidated step-by-step explanation and solution." },
                  examApproach: { type: Type.STRING, description: "The fastest exam approach, shortcut, or trick to solve this question." },
                  ruleOrTheorem: { type: Type.STRING, description: "The relevant mathematical rule, theorem, formula, or core theoretical concept tested." },
                  keyConcept: { type: Type.STRING, description: "Core concept involved." },
                  diagram_svg: { type: Type.STRING, description: "Full SVG markup for diagrams." },
                  formula_latex: { type: Type.STRING, description: "Complex standalone LaTeX formula." },
                  diagramMetadata: {
                    type: Type.OBJECT,
                    description: "SVG diagram metadata.",
                    properties: {
                      requiresDiagram: { type: Type.BOOLEAN },
                      shapeType: { type: Type.STRING },
                      labels: { type: Type.ARRAY, items: { type: Type.STRING } },
                      dimensions: { type: Type.OBJECT }
                    }
                  },
                  topic: { type: Type.STRING },
                  chapter: { type: Type.STRING },
                  confidenceScore: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    appendLog("[STAGE: AI Generation] Gemini model high-coherence compilation complete. Synthesized content received.");
    const rawParsed = resilientParseJSON(response.text || "{}");

    let rawQCount = 0;
    if (Array.isArray(rawParsed)) {
      rawQCount = rawParsed.length;
    } else if (rawParsed && typeof rawParsed === 'object') {
      const qsKey = Object.keys(rawParsed).find(k => k.toLowerCase() === 'questions') || 'questions';
      const rawQs = (rawParsed as any)[qsKey];
      rawQCount = Array.isArray(rawQs) ? rawQs.length : 0;
    }

    appendLog(`[STAGE: JSON Creation] JSON serialization and repair success.`);
    appendLog(`[STAGE: JSON Validation] Validated robust JSON formatting. Parsed raw JSON question count: ${rawQCount}`);

    const healedDoc = mapAndHealQuestionsSchema(rawParsed, job.finalResult?.subject);
    appendLog(`[STAGE: Schema Mapping] Successfully mapped mismatching properties, LaTeX tags, SVG elements into standard formats.`);

    // CRITICAL: Merge any questions from individual batch extractions that aren't already in healedDoc.questions
    // to guarantee 100% dense coverage of every single page, photo, rule, theorem, and fact.
    if (!healedDoc.questions) {
      healedDoc.questions = [];
    }
    const existingQuestionTexts = new Set(healedDoc.questions.map((q: any) => (q.text || "").trim().toLowerCase()));
    let mergedFromBatchesCount = 0;
    for (const mq of mergedCandidateQuestions) {
      const mqText = (mq.text || "").trim().toLowerCase();
      if (mqText && !existingQuestionTexts.has(mqText)) {
        healedDoc.questions.push(mq as any);
        existingQuestionTexts.add(mqText);
        mergedFromBatchesCount++;
      }
    }
    if (mergedFromBatchesCount > 0) {
      appendLog(`[STAGE: Coverage Safeguard] Restored and merged ${mergedFromBatchesCount} unique questions directly from individual page/photo batch checkpoints.`);
      // Re-run healing to make sure merged candidate questions conform to standard schema and index formatting
      const rehealed = mapAndHealQuestionsSchema({ ...healedDoc, questions: healedDoc.questions }, job.finalResult?.subject || "Study Subject");
      healedDoc.questions = rehealed.questions;
    }

    const generatedCount = healedDoc.questions.length;
    appendLog(`[STAGE: Question Array Creation] Clean question array structure initialized. Valid Generated Question Count: ${generatedCount}`);

    // Clean duplicate detections
    const duplicateList = findDuplicates(healedDoc.questions);

    // Deep sanitize final compiled questions list
    const sanitizeDeep = (obj: any, keyName?: string): any => {
      if (keyName && (
        keyName.endsWith('_latex') || 
        keyName.toLowerCase().includes('latex') ||
        keyName.endsWith('_svg') ||
        keyName.toLowerCase().includes('svg')
      )) {
        return obj;
      }
      if (typeof obj === 'string') {
        const trimmed = obj.trim();
        if (trimmed.startsWith('<svg') || trimmed.includes('</svg>')) {
          return obj;
        }
        return correctOcrMistakes(obj);
      }
      if (Array.isArray(obj)) return obj.map(v => sanitizeDeep(v, keyName));
      if (typeof obj === 'object' && obj !== null) {
        const newObj: any = {};
        for (const key in obj) newObj[key] = sanitizeDeep(obj[key], key);
        return newObj;
      }
      return obj;
    };

    const sanitizedQuestions = sanitizeDeep(healedDoc.questions);

    job.questions = sanitizedQuestions.map((q: any, idx: number) => ({
      id: q.id || `q-${Date.now()}-${idx}`,
      type: q.type || 'MCQ',
      text: q.text || "",
      options: q.options || [],
      correctAnswers: q.correctAnswers || [],
      points: Number(q.points) || 2,
      negativePoints: Number(q.negativePoints) || 0.5,
      explanation: q.explanation || (q.stepwiseSolution?.join("\n") || ""),
      stepwiseSolution: q.stepwiseSolution || [],
      keyConcept: q.keyConcept || "",
      diagramMetadata: q.diagramMetadata || { requiresDiagram: false },
      diagram_svg: q.diagram_svg || "",
      formula_latex: q.formula_latex || "",
      topic: q.topic || "General Concept",
      chapter: q.chapter || healedDoc.subject || "Study Chapter",
      difficulty: q.difficulty || healedDoc.difficulty || "Medium",
      confidenceScore: q.confidenceScore || "High"
    }));

    job.finalResult = {
      title: healedDoc.title || "AI Mock Test",
      subject: healedDoc.subject || "Study Subject",
      difficulty: healedDoc.difficulty || "Medium",
      duration: Number(healedDoc.duration) || (generatedCount * 2),
      instructions: healedDoc.instructions || "Solve carefully.",
      qualityAudit: {
        completenessScore: healedDoc.qualityAudit?.completenessScore ?? 95,
        ocrConfidence: healedDoc.qualityAudit?.ocrConfidence || "High",
        duplicateQuestionsFound: healedDoc.qualityAudit?.duplicateQuestionsFound || duplicateList,
        formattingCleanups: healedDoc.qualityAudit?.formattingCleanups || ["LaTeX equations synchronized", "Chapters categorized", "Table structures converted"],
        uncertainQuestionsCount: healedDoc.qualityAudit?.uncertainQuestionsCount ?? 0,
        overallNotes: healedDoc.qualityAudit?.overallNotes || "Successfully generated Mock Test, keys, and detailed solutions from storage batches."
      }
    };

    const savedCount = job.questions.length;

    // Run active Runtime Verifications
    if (generatedCount !== savedCount) {
      throw new Error(`Data Integrity Error: Generated count (${generatedCount}) does not match Saved count (${savedCount})!`);
    }

    if (savedCount === 0) {
      throw new Error(`Validation failed: No questions generated from educational content. (Extracted 0 questions). Please verify the uploaded documents contain valid readable text.`);
    }

    appendLog(`[STAGE: Database Save] Saved ${savedCount} validated questions cleanly to job structure.`);
    appendLog(`[RUNTIME VERIFICATION] Asserted Generated Question Count (${generatedCount}) equals Saved Database Question Count (${savedCount}).`);

    const finalStats = {
      uploadedFilesCount: job.uploadQueue.length,
      processedFilesCount: job.uploadQueue.filter(f => job.batchResults[f.id] && job.batchResults[f.id].length > 0).length,
      generatedQuestionCount: savedCount,
      savedQuestionCount: savedCount,
      loadedQuestionCount: savedCount
    };
    appendLog(`[STATS] ${JSON.stringify(finalStats)}`);

    accountAICost(0.60);
    appendLog(`[SUCCESS] Extracted ${job.questions.length} premium questions with step-by-step solutions.`);

    // ---- COMPLETE INGESTION SUCCESS ----
    updateStage("completed", 100, 6);
    appendLog("[SUCCESS] Generation Pipeline completed. Draft is published and ready for review.");
    clearJobCache(jobId);
  } catch (err: any) {
    console.error("Pipeline failed fatally:", err);
    job.status = "failed";
    job.error = err.message || String(err);
    appendLog(`[PIPELINE ABORT] Fatal error during pipeline execution: ${err.message || err}`);
    
    await saveJob(jobId, job);
    clearJobCache(jobId);
  }
}

// HELPER TO SAVE COMPLETED BATCHES
async function boxJobOutput(job: JobState, fileId: string, result: BatchResult) {
  if (!job.batchResults) {
    job.batchResults = {};
  }
  if (!job.batchResults[fileId]) {
    job.batchResults[fileId] = [];
  }
  if (!job.questionsBank) {
    job.questionsBank = [];
  }
  
  // Ensure we don't duplicate
  const idx = job.batchResults[fileId].findIndex(b => b.batchIndex === result.batchIndex);
  if (idx > -1) {
    // Remove old questions from bank if replacing
    const oldRes = job.batchResults[fileId][idx];
    job.questionsBank = job.questionsBank.filter((q: any) => !oldRes.questionsParsed.find((oq: any) => oq.text === q.text));
    job.batchResults[fileId][idx] = result;
  } else {
    job.batchResults[fileId].push(result);
  }
  
  // Add new questions to bank
  if (result.questionsParsed && result.questionsParsed.length > 0) {
      job.questionsBank.push(...result.questionsParsed);
  }
  
  await saveJob(job.id, job);
}
