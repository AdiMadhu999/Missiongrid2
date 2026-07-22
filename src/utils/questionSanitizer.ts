/**
 * Utility to sanitize AI-generated question text, convert raw mathematical text 
 * into standard valid KaTeX/MathJax expressions, and run strict validation 
 * before saving or publishing tests.
 */

/**
 * 1. Convert common raw math representations (word symbols, symbols, powers)
 * to clean, valid KaTeX/MathJax LaTeX commands.
 */
export function convertMathExpressionsToKaTeX(text: string): string {
  if (!text) return "";

  let res = text;

  // Replace text degrees or degree symbols with KaTeX degrees
  // e.g., 30 degrees, 30°, 30 ° -> 30^\circ
  res = res.replace(/(\d+)\s*(?:degrees|degree|°)/gi, "$1^\\circ");
  res = res.replace(/(?<![\d$])(?:degrees|degree|°)/gi, "\\circ");

  // Convert raw "triangle ABC" or "ΔABC" to \triangle ABC
  res = res.replace(/(?:\btriangle\s+([A-Z]{1,3})\b|Δ\s*([A-Z]{1,3})\b)/g, "\\triangle $1");
  res = res.replace(/(?<![\\$])\btriangle\b(?![A-Za-z$])/gi, "\\triangle");
  res = res.replace(/Δ/g, "\\triangle");

  // Convert raw "angle B" or "∠ABC" to \angle B / \angle ABC
  res = res.replace(/(?:\bangle\s+([A-Z0-9\theta\alpha\beta]{1,3})\b|∠\s*([A-Z0-9\theta\alpha\beta]{1,3})\b)/gi, "\\angle $1");
  res = res.replace(/(?<![\\$])\bangle\b(?![A-Za-z$])/gi, "\\angle");
  res = res.replace(/∠/g, "\\angle");

  // Convert square roots e.g. sqrt(x) or \sqrt(x) to \sqrt{x}
  res = res.replace(/(?:\\sqrt|sqrt)\s*\(([^)]+)\)/gi, "\\sqrt{$1}");
  res = res.replace(/(?:\\sqrt|sqrt)\s+([a-zA-Z0-9]+)/gi, "\\sqrt{$1}");
  // Standalone sqrt
  res = res.replace(/(?<![\\$])\bsqrt\b(?![A-Za-z$])/gi, "\\sqrt{}");

  // Convert Greek pi e.g. "pi" or "π" to \pi
  res = res.replace(/(?<![\\$A-Za-z])\bpi\b(?![A-Za-z$])/g, "\\pi");
  res = res.replace(/π/g, "\\pi");

  // Basic math symbol replacements
  res = res.replace(/\\degree/g, "\\circ");
  res = res.replace(/\\pm/g, "\\pm");
  res = res.replace(/\\approx/g, "\\approx");
  res = res.replace(/\\neq/g, "\\neq");
  res = res.replace(/\\le/g, "\\le");
  res = res.replace(/\\ge/g, "\\ge");
  res = res.replace(/\\times/g, "\\times");
  res = res.replace(/\\div/g, "\\div");

  // Basic algebraic powers e.g. x^2 -> x^{2} (only if not already formatted)
  res = res.replace(/([a-zA-Z0-9])\^([a-zA-Z0-9])\b/g, "$1^{$2}");

  return res;
}

/**
 * 2. Scans text segments and ensures any LaTeX command is wrapped in $ delimiters for KaTeX/MathJax.
 * Operates purely on plain-text segments to avoid double-wrapping.
 */
export function wrapBareLaTeX(text: string): string {
  if (!text) return "";

  // Perform conversions to standard LaTeX commands
  const converted = convertMathExpressionsToKaTeX(text);

  // Split by existing '$' blocks to ensure we don't double wrap already-wrapped math
  const parts = converted.split("$");
  
  for (let i = 0; i < parts.length; i += 2) {
    let plain = parts[i];
    if (!plain) continue;

    // First handle standalone numbers with degrees e.g. 45^\circ -> $45^\circ$
    plain = plain.replace(/(\d+\^?\\circ)/g, "$$1$");

    // Match LaTeX macros starting with \ and their basic parameters/symbols
    // e.g., \triangle, \sqrt{...}, \pi, \angle, \circ, \frac{a}{b}, etc.
    const macroRegex = /(\\(?:triangle|sqrt|pi|angle|circ|frac|theta|alpha|beta|gamma|delta|phi|pm|approx|neq|le|ge|times|div|sum|int|infty)(?:\{[^{}]*\}|\[[^\]]*\]|(?:\s+[A-Za-z0-9_{}]+)|(?:\^[a-zA-Z0-9_{}]+))?)/g;

    plain = plain.replace(macroRegex, (match) => {
      const cleanMatch = match.trim();
      return `$${cleanMatch}$`;
    });

    parts[i] = plain;
  }

  // Re-join
  let joined = parts.join("$");

  // Deduplicate nested $ boundaries e.g. $$ -> $ or $...$$...$
  joined = joined.replace(/\$\$+/g, "$");
  
  // Clean up adjacent math blocks e.g. $A$$B$ -> $A B$
  joined = joined.replace(/\$(.*?)\$\$(.*?)\$/g, "$$1 $2$");

  return joined;
}

/**
 * Checks if the text has invalid or malformed mathematical syntax/formatting.
 * e.g., unmatched '$' delimiters or unbalanced curly braces inside LaTeX blocks.
 */
export function hasInvalidMathFormatting(text: string): boolean {
  if (!text) return false;

  // Check odd number of dollar signs ($) which would break KaTeX rendering
  const dollarCount = (text.match(/\$/g) || []).length;
  if (dollarCount % 2 !== 0) {
    console.warn(`[Math Check Fail] Odd number of dollar signs: ${dollarCount}`);
    return true;
  }

  // Check balanced curly braces '{' and '}' inside each math block
  const parts = text.split("$");
  for (let i = 1; i < parts.length; i += 2) {
    const mathBlock = parts[i];
    let braceDepth = 0;
    for (let charIdx = 0; charIdx < mathBlock.length; charIdx++) {
      const char = mathBlock[charIdx];
      if (char === "{") {
        braceDepth++;
      } else if (char === "}") {
        braceDepth--;
        if (braceDepth < 0) {
          console.warn(`[Math Check Fail] Unbalanced curly braces (negative depth) inside math block: "${mathBlock}"`);
          return true;
        }
      }
    }
    if (braceDepth !== 0) {
      console.warn(`[Math Check Fail] Unbalanced curly braces (unclosed at end) inside math block: "${mathBlock}"`);
      return true;
    }
  }

  return false;
}

/**
 * Validates if the question has a clear, unambiguous definite answer.
 */
export function hasDefiniteAnswer(q: any): boolean {
  if (!q) return false;

  const type = String(q.type || "").toUpperCase();

  // 1. Must have correctAnswers array
  if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) {
    return false;
  }

  // 2. No null, undefined or empty answers allowed
  const hasEmptyKey = q.correctAnswers.some((ans: any) => ans === null || ans === undefined || String(ans).trim() === "");
  if (hasEmptyKey) {
    return false;
  }

  // 3. Check according to question type
  if (type === "MCQ" || type === "MSQ") {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      return false;
    }
    // Correct answer index must map perfectly to an option index
    const invalidIndex = q.correctAnswers.some((ans: any) => {
      const idx = parseInt(String(ans).trim(), 10);
      return isNaN(idx) || idx < 0 || idx >= q.options.length;
    });
    if (invalidIndex) return false;
  } else if (type === "BOOLEAN") {
    const val = String(q.correctAnswers[0]).trim();
    if (val !== "True" && val !== "False") {
      return false;
    }
  } else if (type === "INTEGER" || type === "NUMERIC" || q.type === "Integer") {
    // Correct answer must be parseable as a valid number
    const val = parseFloat(String(q.correctAnswers[0]).trim());
    if (isNaN(val)) return false;
  }

  // 4. Uncertainty check
  if (q.uncertaintyFlag === true) {
    return false;
  }

  const textLower = String(q.text || "").toLowerCase();
  const explLower = String(q.explanation || "").toLowerCase();
  const uncertaintyPhrases = [
    "not sure", "possibly", "could be", "unclear", "no definite", 
    "maybe", "uncertain", "cannot be determined", "insufficient data to"
  ];
  
  const hasUncertaintyWords = uncertaintyPhrases.some(phrase => {
    // Only flag if it suggests AI uncertainty rather than asking a legitimate question
    return (textLower.includes(phrase) && textLower.includes("i am")) || explLower.includes(phrase);
  });
  
  if (hasUncertaintyWords) {
    return false;
  }

  return true;
}

/**
 * Runs validation checks on a single question.
 * Returns failure reasons if invalid.
 */
export function validateQuestionForPublish(q: any): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!q) {
    return { valid: false, reasons: ["Question is null or undefined"] };
  }

  // 1. Every question must contain: Question text
  const text = (q.text || "").trim();
  if (text.length < 5) {
    reasons.push("Missing or extremely short question text (min 5 characters)");
  }

  // 2. Every question must contain: Correct answer (Missing answer key = FAIL)
  if (!q.correctAnswers || !Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) {
    reasons.push("Missing answer key / correct answer list");
  } else {
    const hasEmptyKey = q.correctAnswers.some((ans: any) => ans === null || ans === undefined || String(ans).trim() === "");
    if (hasEmptyKey) {
      reasons.push("Correct answer contains empty or null keys");
    }
  }

  // 3. Every question must contain: Solution/explanation (Empty solution = FAIL)
  const explanation = (q.explanation || "").trim();
  if (explanation.length < 5) {
    reasons.push("Empty or extremely short solution/explanation (min 5 characters)");
  }

  // 4. Invalid math formatting = FAIL
  if (hasInvalidMathFormatting(q.text)) {
    reasons.push("Invalid mathematical LaTeX formatting in Question Text (unbalanced dollars/braces)");
  }
  if (q.options && Array.isArray(q.options)) {
    q.options.forEach((opt: any, idx: number) => {
      if (hasInvalidMathFormatting(String(opt))) {
        reasons.push(`Invalid mathematical LaTeX formatting in Option #${idx + 1}`);
      }
    });
  }
  if (hasInvalidMathFormatting(q.explanation)) {
    reasons.push("Invalid mathematical LaTeX formatting in Solution/Explanation (unbalanced dollars/braces)");
  }

  // 5. Reject any question that does not have a definite answer
  if (!hasDefiniteAnswer(q)) {
    reasons.push("Question lacks a clear, definite answer or is marked as uncertain");
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}

/**
 * Validates a complete list of questions for a test.
 * Returns valid true only if 100% of questions pass validation.
 */
export function validateTestForPublish(questions: any[]): { 
  valid: boolean; 
  failedQuestions: { index: number; text: string; reasons: string[] }[] 
} {
  const failedQuestions: { index: number; text: string; reasons: string[] }[] = [];

  if (!Array.isArray(questions) || questions.length === 0) {
    return {
      valid: false,
      failedQuestions: [{ index: 0, text: "N/A", reasons: ["Test must have at least one question."] }]
    };
  }

  questions.forEach((q, idx) => {
    const report = validateQuestionForPublish(q);
    if (!report.valid) {
      failedQuestions.push({
        index: idx,
        text: q.text || `Question ${idx + 1}`,
        reasons: report.reasons
      });
    }
  });

  return {
    valid: failedQuestions.length === 0,
    failedQuestions
  };
}

/**
 * Heals math formatting to ensure dollar signs and curly braces are balanced.
 */
export function healMathFormatting(text: string): string {
  if (!text) return "";
  let res = text;

  // 1. Balance dollar signs ($)
  const dollarCount = (res.match(/\$/g) || []).length;
  if (dollarCount % 2 !== 0) {
    res = res + "$";
    console.log(`[Heal Math] Appended closing dollar sign to text: "${res}"`);
  }

  // 2. Balance curly braces inside $ blocks
  const parts = res.split("$");
  for (let i = 1; i < parts.length; i += 2) {
    if (!parts[i]) continue;
    let mathBlock = parts[i];
    let braceDepth = 0;
    const chars = mathBlock.split("");
    for (let charIdx = 0; charIdx < chars.length; charIdx++) {
      const char = chars[charIdx];
      if (char === "{") {
        braceDepth++;
      } else if (char === "}") {
        braceDepth--;
        if (braceDepth < 0) {
          chars.splice(charIdx, 1);
          charIdx--;
          braceDepth = 0;
        }
      }
    }
    mathBlock = chars.join("");
    while (braceDepth > 0) {
      mathBlock += "}";
      braceDepth--;
    }
    parts[i] = mathBlock;
  }
  res = parts.join("$");

  return res;
}

/**
 * Sanitizes and formats question texts/expressions.
 */
export function sanitizeQuestionText(text: string): string {
  if (!text) return "";
  // Ensure math symbols and expressions are wrapped inside LaTeX $ formatting
  const wrapped = wrapBareLaTeX(text);
  return healMathFormatting(wrapped);
}

export function sanitizeQuestionObject<T extends any>(obj: T, skipSanitization?: boolean): T {
  if (!obj || skipSanitization) return obj;

  // If already a draft, do not modify
  if ((obj as any).status === 'draft') return obj;

  const sanitized = JSON.parse(JSON.stringify(obj));

  const processValue = (val: any, fieldName?: string): any => {
    // NEVER sanitize SVG dedicated fields
    if (fieldName && (
      fieldName.endsWith('_svg') ||
      fieldName.toLowerCase().includes('svg')
    )) {
      return val;
    }

    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('<svg') || trimmed.includes('</svg>')) {
        return val;
      }
      return sanitizeQuestionText(val);
    } else if (Array.isArray(val)) {
      return val.map(v => processValue(v, fieldName));
    } else if (typeof val === 'object' && val !== null) {
      const newObj: any = {};
      for (const key in val) {
        newObj[key] = processValue(val[key], key);
      }
      return newObj;
    }
    return val;
  };

  // Fields allowed for text/math conversion & sanitization (only math-carrying content fields)
  const fieldsToSanitize = [
    'text', 'explanation', 'options', 'solution', 'stepwiseSolution', 'stepwise_solution'
  ];
  
  const sanitizeTargetFields = (target: any) => {
    if (!target || typeof target !== 'object') return;
    
    // Standard scoring
    if (target.text && target.options && Array.isArray(target.options)) {
      if (!target.points || target.points === 0) target.points = 2;
      if (target.negativePoints === undefined || target.negativePoints === null) {
         target.negativePoints = 0.5;
      }
    }

    for (const key in target) {
      // STRICT BYPASS for SVG fields
      if (key.endsWith('_svg') || key.toLowerCase().includes('svg')) {
        continue;
      }

      if (fieldsToSanitize.includes(key)) {
        target[key] = processValue(target[key], key);
      } else if (typeof target[key] === 'object') {
        sanitizeTargetFields(target[key]);
      }
    }
  };

  sanitizeTargetFields(sanitized);
  return sanitized;
}
