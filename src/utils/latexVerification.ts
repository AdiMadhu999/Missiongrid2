import { sanitizeQuestionText, sanitizeQuestionObject } from './questionSanitizer';

export function runLatexVerification(): boolean {
  const originalLatexList = [
    '\\frac{AB}{QR}',
    '\\text{cm}',
    '\\Delta PAB',
    '\\triangle ABC',
    '\\angle ABC',
    '\\sin\\theta',
    '\\sqrt{x+1}'
  ];

  console.log("=== START LATEX PIPELINE PRESERVATION VERIFICATION ===");
  
  let allPassed = true;
  for (const latex of originalLatexList) {
    const sanitized = sanitizeQuestionText(latex);
    if (sanitized === latex) {
      console.log(`✅ Passed: "${latex}" -> "${sanitized}"`);
    } else {
      console.error(`❌ Failed: "${latex}" -> "${sanitized}"`);
      allPassed = false;
    }
  }

  // Check object-level sanitization and _latex bypassing
  const testObj = {
    text: "Question with \\triangle ABC",
    formula_latex: "\\frac{AB}{QR}",
    solution_latex: "\\sqrt{x+1}",
    explanation_latex: "\\text{cm}",
    option_latex: "\\Delta PAB",
    diagram_formula_latex: "\\sin\\theta",
    options: [
      "Option 1 with \\angle ABC",
      "Option 2 with \\sin\\theta"
    ]
  };

  const sanitizedObj = sanitizeQuestionObject(testObj);
  
  const objKeys = [
    'formula_latex', 'solution_latex', 'explanation_latex', 'option_latex', 'diagram_formula_latex'
  ] as const;

  for (const key of objKeys) {
    if (sanitizedObj[key] === testObj[key]) {
      console.log(`✅ Passed field: "${key}" preserved: "${sanitizedObj[key]}"`);
    } else {
      console.error(`❌ Failed field: "${key}" corrupted: "${sanitizedObj[key]}"`);
      allPassed = false;
    }
  }

  if (sanitizedObj.text === testObj.text) {
    console.log(`✅ Passed field: "text" preserved: "${sanitizedObj.text}"`);
  } else {
    console.error(`❌ Failed field: "text" corrupted!`);
    allPassed = false;
  }

  if (JSON.stringify(sanitizedObj.options) === JSON.stringify(testObj.options)) {
    console.log(`✅ Passed field: "options" preserved`);
  } else {
    console.error(`❌ Failed field: "options" corrupted!`, sanitizedObj.options);
    allPassed = false;
  }

  console.log("=== END LATEX PIPELINE PRESERVATION VERIFICATION ===");
  return allPassed;
}
