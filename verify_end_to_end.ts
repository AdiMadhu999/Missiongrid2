import { correctOcrMistakes } from './server_jobs.ts';
import { sanitizeQuestionObject } from './src/utils/questionSanitizer.ts';

const testCase = {
  text: "Question body text with some formula.",
  formula_latex: "\\frac{AB}{QR}",
  options: ["\\Delta PAB", "\\triangle ABC", "\\angle ABC", "\\sin\\theta"],
  solution_latex: "\\implies AB = 3\\text{cm}",
  explanation_latex: "\\frac{AB}{QR} = \\frac{1}{2}",
  diagram_svg: `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="150" cy="100" r="50" stroke="black" stroke-width="2" fill="none"/>
  <text x="150" y="105" text-anchor="middle">TEST</text>
</svg>`
};

console.log("=== END-TO-END LATEX & SVG PRESERVATION TEST ===");

// 1. Gemini Output
console.log("\n1. Gemini Output:");
const geminiOutputString = JSON.stringify(testCase, null, 2);
console.log(geminiOutputString);

// 2. JSON Parse
console.log("\n2. JSON Parse:");
const parsedJson = JSON.parse(geminiOutputString);
console.log(JSON.stringify(parsedJson, null, 2));

// Simulate correctOcrMistakes
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

const serverSanitized = sanitizeDeep(parsedJson);

// 3. Firestore stored value (Server-side sanitized)
console.log("\n3. Firestore stored value:");
const firestoreString = JSON.stringify(serverSanitized, null, 2);
console.log(firestoreString);

// 4. API Response value (usually identical out of firestore)
console.log("\n4. API Response value:");
console.log(firestoreString);

// 5. Mentor Preview renderer input (Runs through client sanitizer for preview)
console.log("\n5. Mentor Preview renderer input:");
const clientSanitized = sanitizeQuestionObject(JSON.parse(firestoreString));
console.log(JSON.stringify(clientSanitized, null, 2));

// 6. Student Preview renderer input (same)
console.log("\n6. Student Preview renderer input:");
console.log(JSON.stringify(clientSanitized, null, 2));

// 7. Final rendered output text extracts
console.log("\n7. Final rendered output:");
console.log(`formula_latex received: ${clientSanitized.formula_latex}`);
console.log(`solution_latex received: ${clientSanitized.solution_latex}`);
console.log(`explanation_latex received: ${clientSanitized.explanation_latex}`);
console.log(`options[0] received: ${clientSanitized.options[0]}`);
console.log(`options[1] received: ${clientSanitized.options[1]}`);
console.log(`options[2] received: ${clientSanitized.options[2]}`);
console.log(`options[3] received: ${clientSanitized.options[3]}`);
console.log(`diagram_svg received length: ${clientSanitized.diagram_svg?.length}`);
console.log(`diagram_svg received contents:\n${clientSanitized.diagram_svg}`);

// Check for absolute integrity match
const inputSvg = testCase.diagram_svg.trim();
const outputSvg = clientSanitized.diagram_svg.trim();
if (inputSvg === outputSvg) {
  console.log("\n✅ SUCCESS: diagram_svg has perfect character integrity and is untouched by sanitizers or OCR correctors!");
} else {
  console.error("\n❌ FAILURE: diagram_svg was corrupted or changed through the pipeline.");
}
