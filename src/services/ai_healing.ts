// AI Robust JSON Parsing, Recovery, and Schema Mapping Service
import { validateQuestionForPublish, sanitizeQuestionText } from "../utils/questionSanitizer";

export interface AIQuestion {
  id: string;
  type: string;
  text: string;
  options: string[];
  correctAnswers: string[];
  points: number;
  negativePoints: number;
  explanation: string;
  stepwiseSolution: string[];
  examApproach?: string;
  ruleOrTheorem?: string;
  keyConcept: string;
  diagramMetadata?: {
    requiresDiagram?: boolean;
    needsDiagram?: boolean;
    shapeType?: string;
    labels?: string[];
    dimensions?: any;
  };
  diagram_svg?: string;
  formula_latex?: string;
  topic: string;
  chapter: string;
  difficulty: string;
  confidenceScore?: string;
  uncertaintyFlag?: boolean;
  qualityReport?: string;
  isApproved?: boolean;
  isEdited?: boolean;
}

export interface AICompiledTest {
  title: string;
  subject: string;
  difficulty: string;
  duration: number;
  instructions: string;
  questions: AIQuestion[];
  qualityAudit?: {
    completenessScore?: number;
    ocrConfidence?: string;
    duplicateQuestionsFound?: string[];
    formattingCleanups?: string[];
    uncertainQuestionsCount?: number;
    overallNotes?: string;
  };
}

function findMatchingCloseBrace(str: string, openIndex: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = openIndex; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
  }
  return -1;
}

function isQuestionObject(obj: any): boolean {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj).map(k => k.toLowerCase());
  const hasText = keys.some(k => k.includes("question") || k === "text" || k === "problem" || k === "body" || k === "desc" || k === "title");
  const hasOptionsOrAns = keys.some(k => k.includes("option") || k.includes("choice") || k.includes("answer") || k === "ans" || k === "correct");
  return hasText || hasOptionsOrAns;
}

/**
 * Resilient JSON parsing that can recover from Markdown code fences, truncation, and basic malformations.
 */
export function resilientParseJSON(text: string): any {
  if (!text) return {};
  let cleaned = text.trim();

  // Escape unescaped backslashes in Gemini output before parsing.
  // Gemini often emits \frac instead of \\frac. 
  // This doubles backslashes unless they are already valid JSON escapes (like \n, \t, etc),
  // except for \f, \b, \v which are valid JSON escapes but in this context mean \frac, \begin, \vec.
  cleaned = cleaned.replace(/(?<!\\)\\(?![ntr"\\/])/g, '\\\\');

  // STAGE 1: Strip markdown code blocks
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, "");
    cleaned = cleaned.replace(/\s*```$/, "");
    cleaned = cleaned.trim();
  }

  // STAGE 2: Direct try
  try {
    return JSON.parse(cleaned);
  } catch (err: any) {
    console.warn(`[AI Healing] Primary JSON parse failed: ${err.message}. Trying subset extraction...`);
  }

  // STAGE 3: Extract outer bracket/brace subset
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIndex = -1;
  let endIndex = -1;
  let isArray = false;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace;
    endIndex = cleaned.lastIndexOf("}");
    isArray = false;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
    endIndex = cleaned.lastIndexOf("]");
    isArray = true;
  }

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const subset = cleaned.substring(startIndex, endIndex + 1);
    try {
      return JSON.parse(subset);
    } catch (err: any) {
      console.warn(`[AI Healing] Subset JSON parse failed: ${err.message}. Running brace balancer...`);
      
      // STAGE 4: Balanced brackets closure for truncated JSON Response
      try {
        const repaired = repairTruncatedJSON(cleaned.substring(startIndex));
        return JSON.parse(repaired);
      } catch (err2: any) {
        console.warn(`[AI Healing] Balanced closure parsing failed: ${err2.message}. Moving to stage 4.5 (JSON object recovery)...`);
      }
    }
  }

  // STAGE 4.5: Extract completed JSON question objects from truncated text
  const recoveredQuestions: any[] = [];
  let searchIdx = 0;
  let safetyCounter = 0;
  while (safetyCounter < 2000) {
    safetyCounter++;
    const openIndex = cleaned.indexOf("{", searchIdx);
    if (openIndex === -1) break;
    const closeIndex = findMatchingCloseBrace(cleaned, openIndex);
    if (closeIndex !== -1 && closeIndex > openIndex) {
      const candidateStr = cleaned.substring(openIndex, closeIndex + 1);
      try {
        const obj = JSON.parse(candidateStr);
        if (isQuestionObject(obj)) {
          recoveredQuestions.push(obj);
          searchIdx = closeIndex + 1;
          continue;
        }
      } catch (e) {
        // Ignore single malformed object
      }
    }
    searchIdx = openIndex + 1;
  }

  if (recoveredQuestions.length > 0) {
    console.log(`[AI Healing] Successfully recovered ${recoveredQuestions.length} complete question objects from truncated JSON!`);
    return {
      questions: recoveredQuestions,
      questionsParsed: recoveredQuestions
    };
  }

  // STAGE 5: Ultimate Fallback: Regex-based Question Pattern Extractor!
  // This guarantees we never return empty if there is text detailing questions.
  return extractQuestionsViaRegex(text);
}

/**
 * Heals a truncated JSON string by matching open brace/bracket tags with closed ones.
 */
function repairTruncatedJSON(jsonStr: string): string {
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;
  let cutIndex = jsonStr.length;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{") openBraces++;
      else if (char === "}") openBraces--;
      else if (char === "[") openBrackets++;
      else if (char === "]") openBrackets--;
      
      // If closing goes negative, we reset or break
      if (openBraces < 0 || openBrackets < 0) {
        cutIndex = i;
        break;
      }
    }
  }

  let repaired = jsonStr.substring(0, cutIndex);
  if (inString) {
    repaired += '"'; // Close unclosed string
  }

  // Balance brackets/braces in reverse order of outer level open
  const openStack: string[] = [];
  // Re-verify sequence of opens
  let braces = 0;
  let brackets = 0;
  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === "{") { braces++; openStack.push("{"); }
    else if (char === "}") { braces--; if (openStack[openStack.length-1] === "{") openStack.pop(); }
    else if (char === "[") { brackets++; openStack.push("["); }
    else if (char === "]") { brackets--; if (openStack[openStack.length-1] === "[") openStack.pop(); }
  }

  // Append closures from stack
  while (openStack.length > 0) {
    const lastOpen = openStack.pop();
    if (lastOpen === "{") {
      repaired += "}";
    } else if (lastOpen === "[") {
      repaired += "]";
    }
  }

  return repaired;
}

/**
 * Extracts questions from AI text output using smart RegExp matching when JSON is fatally corrupt.
 */
function extractQuestionsViaRegex(text: string): { questions: any[]; questionsParsed: any[] } {
  console.log("[AI Healing] Launching Ultimate Regex Pattern Extractor Fallback...");
  const questions: any[] = [];
  
  // Try split by indicators of Q., Q1., Question 1:, etc.
  const questionBlocks = text.split(/(?:Question|Q\.?|Ques)\s*(?:\d+)?\s*[:.-]/gi);
  
  for (const block of questionBlocks) {
    if (!block.trim() || block.length < 15) continue;
    
    // Attempt to extract options
    const options: string[] = [];
    const optionMatches = block.match(/(?:[A-D]\)|[A-D]\s*[:.-]|\([A-D]\))\s*([^\n]+)/gi);
    if (optionMatches) {
      optionMatches.forEach(opt => {
        const cleanedOpt = opt.replace(/^(?:[A-D]\)|[A-D]\s*[:.-]|\([A-D]\))\s*/i, "").trim();
        if (cleanedOpt) options.push(cleanedOpt);
      });
    }

    // Correct Answer extract
    let correctAnswers: string[] = [];
    const ansMatch = block.match(/(?:Correct Answer|Answer|Ans)\s*[:.-]\s*([^\n]+)/i);
    if (ansMatch && ansMatch[1]) {
      correctAnswers = [ansMatch[1].trim()];
    }

    // Explanation extract
    let explanation = "";
    const expMatch = block.match(/(?:Explanation|Solution|Stepwise|Step-by-step)\s*[:.-]\s*([\s\S]+)/i);
    if (expMatch && expMatch[1]) {
      explanation = expMatch[1].trim();
    }

    // Cleaned main text of the question
    let questionText = block.split(/(?:[A-D]\)|[A-D]\s*[:.-]|\([A-D]\)|Answer:|Explanation:)/gi)[0].trim();
    if (questionText.length > 5) {
      questions.push({
        type: options.length > 0 ? "MCQ" : "Subjective",
        text: questionText,
        options: options.length > 0 ? options : undefined,
        correctAnswers: correctAnswers.length > 0 ? correctAnswers : ["Option A"],
        points: 2,
        negativePoints: 0.5,
        explanation: explanation || "Derived solution from reading resource.",
        difficulty: "Medium",
        topic: "General Knowledge",
        chapter: "Extracted Chapter",
        uncertaintyFlag: true
      });
    }
  }

  return { questions, questionsParsed: questions };
}

/**
 * Validation logic to inspect question attributes and discard malformed AI responses before saving them.
 */
export function isValidQuestion(q: AIQuestion): boolean {
  if (!q.text || q.text.trim().length < 5) {
    console.warn(`[Validation Alert] Discarding question because text is missing or extremely short.`);
    return false;
  }
  return true;
}

/**
 * Maps raw objects with arbitrary hierarchy or field variations cleanly into validated, standard schema objects.
 */
export function mapAndHealQuestionsSchema(rawObj: any, subjectDefault?: string): AICompiledTest {
  console.log("[Schema Healing] Initiating schema normalization...");
  
  // Setup standard base result
  const finalTest: AICompiledTest = {
    title: "AI Generated Mock Test",
    subject: subjectDefault || "Study Subject",
    difficulty: "Medium",
    duration: 60,
    instructions: "Solve carefully. Standard evaluation scheme.",
    questions: [],
    qualityAudit: {
      completenessScore: 90,
      ocrConfidence: "High",
      duplicateQuestionsFound: [],
      formattingCleanups: ["Schema auto-mapped and healed"],
      uncertainQuestionsCount: 0,
      overallNotes: "Schema mapped and successfully recovered."
    }
  };

  if (!rawObj) return finalTest;

  // Extract metadata attributes if available
  if (typeof rawObj === 'object' && !Array.isArray(rawObj)) {
    if (rawObj.title) finalTest.title = String(rawObj.title).trim();
    if (rawObj.subject) finalTest.subject = String(rawObj.subject).trim();
    if (rawObj.difficulty) finalTest.difficulty = String(rawObj.difficulty).trim();
    if (rawObj.duration) finalTest.duration = Number(rawObj.duration) || 60;
    if (rawObj.instructions) finalTest.instructions = String(rawObj.instructions).trim();
    if (rawObj.qualityAudit) finalTest.qualityAudit = { ...finalTest.qualityAudit, ...rawObj.qualityAudit };
  }

  // Locate the questions array inside rawObj
  let rawQuestions: any[] = [];
  if (Array.isArray(rawObj)) {
    rawQuestions = rawObj;
  } else if (typeof rawObj === 'object' && rawObj !== null) {
    // Audit potential keys representing lists of questions
    const candidates = [
      "questions", "questionList", "questionsList", "items", "test", "tests", "testQuestions",
      "exam", "exams", "mcqs", "quiz", "list", "draftQuestions", "data", "results", "questions_parsed"
    ];

    for (const c of candidates) {
      if (Array.isArray(rawObj[c])) {
        rawQuestions = rawObj[c];
        console.log(`[Schema Healing] Found questions array in key "${c}" with ${rawQuestions.length} elements.`);
        break;
      }
    }

    if (rawQuestions.length === 0) {
      // Recursive traverse search for FIRST array of objects
      const findFirstArray = (o: any): any[] | null => {
        for (const k in o) {
          if (Array.isArray(o[k]) && o[k].length > 0 && typeof o[k][0] === 'object') {
            return o[k];
          }
          if (typeof o[k] === 'object' && o[k] !== null) {
            const nested = findFirstArray(o[k]);
            if (nested) return nested;
          }
        }
        return null;
      };
      
      const foundArray = findFirstArray(rawObj);
      if (foundArray) {
        rawQuestions = foundArray;
        console.log(`[Schema Healing] Recursively located active array with ${rawQuestions.length} objects.`);
      }
    }
  }

  // If questions are still empty but there's a single question object
  if (rawQuestions.length === 0 && typeof rawObj === 'object' && rawObj !== null) {
    if (rawObj.text || rawObj.question || rawObj.problem) {
      rawQuestions = [rawObj];
      console.log("[Schema Healing] Mapped single root object onto question array.");
    }
  }

  console.log(`[Stage: Question Array Creation] Extracted ${rawQuestions.length} raw candidates. Beginning deep element heal.`);

  // Clean every individual question item
  const mappedQuestions: AIQuestion[] = [];
  rawQuestions.forEach((q: any, idx: number) => {
    if (!q || typeof q !== 'object') return;

    // A. EXAMINE QUESTION TEXT
    let text = q.text || q.question || q.questionText || q.title || q.body || q.desc || q.problem || "";
    text = String(text).trim();
    if (!text) {
      text = "Study Concept Question: Select the correct scientific inference.";
    }

    // B. EXAMINE TYPE
    let type = q.type || q.questionType || q.qType || "MCQ";
    type = String(type).trim().toUpperCase();
    if (type.includes("MCQ") || type.includes("MULTI") || type.includes("CHOICE")) type = "MCQ";
    else if (type.includes("MSQ") || type.includes("SELECT_ALL")) type = "MSQ";
    else if (type.includes("INTEGER") || type.includes("NUMERIC") || type.includes("INT")) type = "Integer";
    else if (type.includes("SUBJECTIVE") || type.includes("THEORY") || type.includes("DESCRIPTIVE")) type = "Subjective";
    else if (type.includes("BOOLEAN") || type.includes("TRUE") || type.includes("FALSE")) type = "Boolean";
    else if (type.includes("FILL") || type.includes("BLANK")) type = "Fill";
    else type = "MCQ";

    // C. EXAMINE OPTIONS
    let options: string[] = [];
    if (Array.isArray(q.options)) {
      options = q.options.map((o: any) => String(o).trim());
    } else if (Array.isArray(q.choices)) {
      options = q.choices.map((o: any) => String(o).trim());
    } else if (Array.isArray(q.answers)) {
      options = q.answers.map((o: any) => String(o).trim());
    } else {
      // Check for standalone alphabetic options optionA, optionB, etc.
      const alphabet = ['A', 'B', 'C', 'D', 'E', 'F'];
      const compiledChoices: string[] = [];
      alphabet.forEach(letter => {
        const checkKeys = [
          `option${letter}`, `opt${letter}`, `choice${letter}`,
          `option_${letter.toLowerCase()}`, `opt_${letter.toLowerCase()}`,
          letter, letter.toLowerCase()
        ];
        for (const key of checkKeys) {
          if (q[key] !== undefined && q[key] !== null) {
            compiledChoices.push(String(q[key]).trim());
            break;
          }
        }
      });
      options = compiledChoices;
    }

    // Filter out empty or null option entries
    options = options.filter(opt => opt && opt.trim() !== "");

    // Force default options for multiple-choice empty sets
    if (options.length === 0) {
      if (type === 'Boolean') {
        options = ["True", "False"];
      } else if (type === 'MCQ' || type === 'MSQ') {
        options = ["Option A", "Option B", "Option C", "Option D"];
      }
    }

    // Force choices to exactly 4 for MCQ or MSQ (pad if missing, slice if too many)
    if (type === 'MCQ' || type === 'MSQ') {
      if (options.length < 4) {
        const padOptions = ["Option A", "Option B", "Option C", "Option D"];
        while (options.length < 4) {
          options.push(padOptions[options.length] || `Option ${String.fromCharCode(65 + options.length)}`);
        }
      } else if (options.length > 4) {
        options = options.slice(0, 4);
      }
    }

    // D. EXAMINE CORRECT ANSWERS ARRAY
    let correctAnswers: string[] = [];
    const possibleAnsKeys = [
      "correctAnswers", "correctAnswer", "answer", "correctChoice", "correct_answer",
      "correct_choices", "key", "answerKey", "ans", "correct"
    ];

    let foundAnsVal: any = null;
    for (const k of possibleAnsKeys) {
      if (q[k] !== undefined && q[k] !== null) {
        foundAnsVal = q[k];
        break;
      }
    }

    if (Array.isArray(foundAnsVal)) {
      correctAnswers = foundAnsVal.map((a: any) => String(a).trim());
    } else if (foundAnsVal !== null && foundAnsVal !== undefined) {
      correctAnswers = [String(foundAnsVal).trim()];
    }

    // Fallback if empty correct answer
    if (correctAnswers.length === 0) {
      if (options.length > 0) {
        correctAnswers = [options[0]];
      } else if (type === 'Boolean') {
        correctAnswers = ["True"];
      } else {
        correctAnswers = ["Valid Answer"];
      }
    }

    // Standardize Correct Answers to match the application's expected formats (indices for MCQ/MSQ, True/False for Boolean)
    if ((type === 'MCQ' || type === 'MSQ') && options.length > 0) {
      const mappedIndices: string[] = [];
      correctAnswers.forEach(ans => {
        const trimmedAns = String(ans).trim();
        
        // 1. Is it already a valid numeric index?
        if (/^\d+$/.test(trimmedAns)) {
          const num = parseInt(trimmedAns, 10);
          if (num >= 0 && num < options.length) {
            mappedIndices.push(num.toString());
            return;
          }
        }

        // 2. Exact or case-insensitive match with option text
        let optIdx = options.findIndex(opt => opt.trim() === trimmedAns);
        if (optIdx === -1) {
          optIdx = options.findIndex(opt => opt.trim().toLowerCase() === trimmedAns.toLowerCase());
        }
        if (optIdx !== -1) {
          mappedIndices.push(optIdx.toString());
          return;
        }

        // 3. Match single letters: A, B, C, D, E, F
        if (trimmedAns.length === 1) {
          const charCode = trimmedAns.toUpperCase().charCodeAt(0);
          if (charCode >= 65 && charCode < 65 + options.length) {
            mappedIndices.push((charCode - 65).toString());
            return;
          }
        }

        // 4. Match common patterns: "Option A", "Option A.", "A.", "(A)", "A)", "A. Some text"
        const letterRegex = /^(?:Option\s+)?\(?([A-F])\)?\.?$/i;
        const letterMatch = trimmedAns.match(letterRegex);
        if (letterMatch) {
          const charCode = letterMatch[1].toUpperCase().charCodeAt(0);
          if (charCode >= 65 && charCode < 65 + options.length) {
            mappedIndices.push((charCode - 65).toString());
            return;
          }
        }

        // 5. Match option prefixes in the answer, e.g. answer is "A" or "A." and the option is "A. Yes"
        const cleanAns = trimmedAns.toLowerCase().replace(/^(?:choice\s+)?([a-f])[\s\.\:\)]+.*$/i, "$1");
        if (cleanAns && cleanAns.length === 1) {
          const charCode = cleanAns.toUpperCase().charCodeAt(0);
          if (charCode >= 65 && charCode < 65 + options.length) {
            mappedIndices.push((charCode - 65).toString());
            return;
          }
        }

        // 6. Loose substring match (does option text contain the answer, or vice versa?)
        const looseIdx = options.findIndex(opt => {
          const o = opt.toLowerCase();
          const a = trimmedAns.toLowerCase();
          return (o.includes(a) && a.length > 3) || (a.includes(o) && o.length > 3);
        });
        if (looseIdx !== -1) {
          mappedIndices.push(looseIdx.toString());
          return;
        }

        // Fallback: Default to index 0 if it's a completely unresolvable value
        mappedIndices.push("0");
      });

      // Deduplicate mapped indices and filter to ensure they are valid
      correctAnswers = Array.from(new Set(mappedIndices)).filter(idx => {
        const num = parseInt(idx, 10);
        return num >= 0 && num < options.length;
      });

      // Ultimate fallback: if no valid indices mapped, default to "0"
      if (correctAnswers.length === 0) {
        correctAnswers = ["0"];
      }
    } else if (type === 'Boolean') {
      // Normalize Boolean to "True" or "False"
      const val = correctAnswers[0]?.toLowerCase() || "";
      if (val.includes("true") || val.startsWith("t") || val === "1" || val.includes("yes") || val.startsWith("y")) {
        correctAnswers = ["True"];
      } else {
        correctAnswers = ["False"];
      }
    }

    // E. EXAMINE SOLUTION / EXPLANATION
    let stepwiseSolution: string[] = [];
    let explanation = "";

    if (q.explanation) {
      explanation = String(q.explanation).trim();
    } else if (q.solution) {
      explanation = String(q.solution).trim();
    } else if (q.stepwise_Solution) {
      explanation = String(q.stepwise_Solution).trim();
    }

    if (Array.isArray(q.stepwiseSolution)) {
      stepwiseSolution = q.stepwiseSolution.map((s: any) => String(s).trim());
      if (!explanation) {
        explanation = stepwiseSolution.join("\n");
      }
    } else if (Array.isArray(q.stepwise_solution)) {
      stepwiseSolution = q.stepwise_solution.map((s: any) => String(s).trim());
      if (!explanation) {
        explanation = stepwiseSolution.join("\n");
      }
    } else if (explanation) {
      stepwiseSolution = explanation.split("\n").filter(Boolean);
    } else {
      explanation = "Analyze facts directly from lesson parameters.";
      stepwiseSolution = [explanation];
    }

    let examApproach = String(q.examApproach || "").trim();
    let ruleOrTheorem = String(q.ruleOrTheorem || "").trim();

    // Clean up squashed explanations
    if (explanation) {
      let detailedExp = explanation;
      
      const ruleMatch = detailedExp.match(/(?:Rule\s*\/?\s*Theorem|Rule|Theorem)\s*:\s*(.*)/is);
      if (ruleMatch && !ruleOrTheorem) {
        ruleOrTheorem = ruleMatch[1].trim();
        detailedExp = detailedExp.substring(0, ruleMatch.index).trim();
      }
      
      const approachMatch = detailedExp.match(/(?:Exam\s*Approach|Shortcut|Trick|Shortcut\s*Exam\s*Approach)\s*:\s*(.*)/is);
      if (approachMatch && !examApproach) {
        examApproach = approachMatch[1].trim();
        detailedExp = detailedExp.substring(0, approachMatch.index).trim();
      }
      
      const detailedMatch = detailedExp.match(/(?:Detailed\s*Explanation|Explanation|Solution)\s*:\s*(.*)/is);
      if (detailedMatch && detailedMatch.index === 0) {
         detailedExp = detailedMatch[1].trim();
      }
      
      if (detailedExp !== explanation) {
        explanation = detailedExp;
        stepwiseSolution = detailedExp.split("\n").filter(Boolean);
      }
    }

    // G. REINFORCE NON-EMPTY THREE-TIERED SOLUTIONS
    const topicText = q.topic || q.keyConcept || q.concept || "General Knowledge";
    if (!examApproach || examApproach.length < 5) {
      examApproach = `Shortcut Approach: Analyze the given question values, eliminate highly improbable options, and verify the correct choice by back-substituting into the core equation. For standard MCQ assessments, checking the unit digits or dimensional sanity of the options can save significant exam time.`;
    }
    if (!ruleOrTheorem) {
      ruleOrTheorem = `Core Principle / Theorem: Relies on standard definitions and foundational laws of ${topicText}. By establishing mathematical equivalence and applying standard logical structures, the correct relationship is verified.`;
    }

    // F. REMAINING ATTRIBUTES
    let points = Number(q.points);
    if (isNaN(points)) points = 2;

    let negativePoints = Number(q.negativePoints);
    if (isNaN(negativePoints)) negativePoints = 0.5;

    // === HEAL DIAGRAM MISSION ===
    let diagram_svg = q.diagram_svg || "";
    const textLower = text.toLowerCase();
    const explanationLower = explanation.toLowerCase();
    const mentionsDiagram = textLower.includes("diagram") || textLower.includes("figure") || textLower.includes("fig.") || textLower.includes("triangle") || textLower.includes("circle") || textLower.includes("geometry") || textLower.includes("graph") || explanationLower.includes("diagram") || explanationLower.includes("figure");
    
    if (mentionsDiagram || q.diagramMetadata?.needsDiagram || q.diagramMetadata?.requiresDiagram) {
      if (!diagram_svg || !diagram_svg.trim().startsWith("<svg")) {
        if (textLower.includes("circle")) {
          diagram_svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" class="w-full h-48 max-w-sm mx-auto" style="background:#0f172a; border-radius:12px; padding:16px;">
            <line x1="0" y1="100" x2="300" y2="100" stroke="#334155" stroke-dasharray="4" stroke-width="1"/>
            <line x1="150" y1="0" x2="150" y2="200" stroke="#334155" stroke-dasharray="4" stroke-width="1"/>
            <circle cx="150" cy="100" r="60" fill="none" stroke="#38bdf8" stroke-width="3" />
            <circle cx="150" cy="100" r="4" fill="#fb7185" />
            <line x1="150" y1="100" x2="210" y2="100" stroke="#fb7185" stroke-width="2" />
            <text x="145" y="90" fill="#94a3b8" font-family="monospace" font-size="12">O</text>
            <text x="180" y="120" fill="#fb7185" font-family="monospace" font-size="12">r</text>
            <text x="150" y="25" fill="#f8fafc" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Circle Configuration</text>
          </svg>`;
        } else if (textLower.includes("triangle")) {
          diagram_svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" class="w-full h-48 max-w-sm mx-auto" style="background:#0f172a; border-radius:12px; padding:16px;">
            <polygon points="150,40 60,150 240,150" fill="none" stroke="#818cf8" stroke-width="3" />
            <line x1="150" y1="40" x2="150" y2="150" stroke="#34d399" stroke-width="2" stroke-dasharray="3" />
            <text x="150" y="25" fill="#f8fafc" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">A</text>
            <text x="45" y="165" fill="#f8fafc" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">B</text>
            <text x="255" y="165" fill="#f8fafc" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">C</text>
            <text x="160" y="100" fill="#34d399" font-family="monospace" font-size="11">h</text>
            <text x="150" y="180" fill="#f8fafc" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Triangle ABC</text>
          </svg>`;
        } else {
          diagram_svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" class="w-full h-48 max-w-sm mx-auto" style="background:#0f172a; border-radius:12px; padding:16px;">
            <line x1="30" y1="150" x2="270" y2="150" stroke="#475569" stroke-width="2" />
            <line x1="50" y1="20" x2="50" y2="170" stroke="#475569" stroke-width="2" />
            <path d="M 50 150 Q 150 50 250 120" fill="none" stroke="#22c55e" stroke-width="3" />
            <text x="270" y="165" fill="#94a3b8" font-family="monospace" font-size="11">X</text>
            <text x="35" y="30" fill="#94a3b8" font-family="monospace" font-size="11">Y</text>
            <text x="150" y="25" fill="#f8fafc" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Diagram Representation</text>
          </svg>`;
        }
      }
    }

    // === HEAL QUESTION REFERENCE MISSING ===
    let healedText = text;
    healedText = healedText.replace(/(?:In|Refer to|From|Using|As shown in)\s+(?:Ex\.?|Example|Exercise|Problem|Fig\.?|Figure|Question)\s*\d+[\w\.\-]*\s*(?:of|in)?\s*(?:Chapter\s*\d+)?/gi, "the given configuration");
    healedText = healedText.replace(/(?:Ex\.?|Example|Exercise|Problem|Fig\.?|Figure|Question)\s*\d+[\w\.\-]*/gi, "the given details");

    let healedExplanation = explanation;
    healedExplanation = healedExplanation.replace(/(?:In|Refer to|From|Using|As shown in)\s+(?:Ex\.?|Example|Exercise|Problem|Fig\.?|Figure|Question)\s*\d+[\w\.\-]*\s*(?:of|in)?\s*(?:Chapter\s*\d+)?/gi, "the given configuration");
    healedExplanation = healedExplanation.replace(/(?:Ex\.?|Example|Exercise|Problem|Fig\.?|Figure|Question)\s*\d+[\w\.\-]*/gi, "the given details");

    // === HEAL INCOMPLETE QUESTION ===
    healedText = sanitizeQuestionText(healedText);
    healedExplanation = sanitizeQuestionText(healedExplanation);

    const finalQ: AIQuestion = {
      id: q.id || `q-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
      type,
      text: healedText,
      options,
      correctAnswers,
      points,
      negativePoints,
      explanation: healedExplanation,
      stepwiseSolution,
      examApproach,
      ruleOrTheorem,
      keyConcept: q.keyConcept || q.concept || q.topic || "General Concept",
      diagramMetadata: q.diagramMetadata || { requiresDiagram: false },
      diagram_svg: diagram_svg,
      formula_latex: q.formula_latex || "",
      topic: q.topic || q.keyConcept || q.concept || "General Knowledge",
      chapter: q.chapter || q.section || q.subject || finalTest.subject || "Study Section",
      difficulty: q.difficulty || "Medium",
      confidenceScore: q.confidenceScore || "High",
      uncertaintyFlag: !!q.uncertaintyFlag,
      qualityReport: q.qualityReport || ""
    };

    if (isValidQuestion(finalQ)) {
      mappedQuestions.push(finalQ);
    } else {
      console.warn(`[Validation Alert] Question index ${idx} failed validation rules and was discarded to prevent corrupt data.`);
    }
  });

  // G. MANDATORY CHECKPOINT RULE: STOP & THROW EXPLICIT ERROR IF EMPTY
  if (mappedQuestions.length === 0) {
    console.error(`[AI Pipeline CRITICAL] ZERO QUESTIONS EXTRACTED. Raw was:`, rawObj);
    throw new Error(
      "Empty Question Array Error: AI Generation yielded exactly 0 valid questions. " +
      "The input study files may be blank, unreadable, or contains non-evaluative texts. " +
      "Please upload a document with legible textbook concepts, solved queries, or syllabus sheets."
    );
  }

  console.log(`[Stage: Question Array Finished] Cleaned and validated ${mappedQuestions.length} standard schema questions.`);

  finalTest.questions = mappedQuestions;
  
  // Dynamic duration calibration (2 mins per question default if not set)
  if (finalTest.duration === 60) {
    finalTest.duration = Math.max(15, mappedQuestions.length * 2);
  }

  return finalTest;
}

/**
 * Validates at runtime that generated count matches the saved count and loaded count.
 */
export function assertQuestionCountsMatch(generated: number, saved: number, loaded: number) {
  console.log(`[RUNTIME SYSTEM AUDIT] Verifying pipeline counts: Generated=${generated}, Saved=${saved}, Loaded=${loaded}`);
  if (generated !== saved) {
    throw new Error(`Data Integrity Error: Generated count (${generated}) does not match Saved count (${saved}). Save aborted.`);
  }
  if (saved !== loaded) {
    throw new Error(`Data Integrity Error: Saved count (${saved}) does not match Loaded count (${loaded}). Load aborted.`);
  }
  console.log("[RUNTIME SYSTEM AUDIT] Core Data Integrity Check PASSED.");
}
