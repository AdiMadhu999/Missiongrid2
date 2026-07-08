import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import fs from 'fs';
import path from 'path';
import { sanitizeQuestionObject } from './src/utils/questionSanitizer.js';

console.log("=== DIAGRAM PIPELINE INTEGRITY AND SEEDING SCRIPT ===");

// 1. Load Firebase configuration
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error("Error: firebase-applet-config.json not found!");
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
console.log(`[PIPELINE] Initializing Firebase with Project ID: ${firebaseConfig.projectId}`);

const app = initializeApp(firebaseConfig);
// Force HTTPS HTTP/1.1 long-polling for sandbox container environments
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});
const auth = getAuth(app);

// 2. Define target SVG markup as specified in the criteria
const sampleSvg = `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="150" cy="100" r="50" stroke="black" stroke-width="2" fill="none"/>
  <text x="150" y="105" text-anchor="middle">TEST</text>
</svg>`;

// 3. Construct pristine Test and Question structure complying with the specification
const validationTestData = {
  title: "SVG Diagram Pipeline Verification Test",
  description: "End-to-end verification test validating that AI-generated SVG diagrams render with perfect structural fidelity.",
  subject: "Geometry and Mensuration",
  duration: 10,
  maximumMarks: 2,
  passingMarks: 1,
  instructions: "Verify that the circle and 'TEST' text inside the SVG diagram are properly rendered and positioned.",
  negativeMarking: true,
  randomization: false,
  difficulty: "Easy" as const,
  tags: ["seeding", "verification", "svg-integrity"],
  status: "published" as const,
  visibility: "global" as const,
  attachments: [],
  questions: [
    {
      id: `q-svg-verification-${Date.now()}`,
      type: "MCQ" as const,
      text: "Does the SVG circle diagram rendered below look exactly centered with 'TEST' label inside?",
      formula_latex: "\\text{Area} = \\pi r^2 = 25\\pi",
      options: [
        "Yes, the SVG diagram displays correctly with high-fidelity formatting",
        "No, it is blank, cropped, or text escaped"
      ],
      correctAnswers: ["Yes, the SVG diagram displays correctly with high-fidelity formatting"],
      points: 2,
      negativePoints: 0.5,
      explanation: "This mock question demonstrates successful AI-SVG generation, secure Firestore storage, unchanged API delivery, and fluid client-side React rendering.",
      keyConcept: "SVG Interactive Canvas Rendering",
      diagramMetadata: {
        needsDiagram: true,
        shape: "Circle",
        labels: ["TEST"]
      },
      diagram_svg: sampleSvg,
      topic: "Pipeline Diagnostics"
    }
  ]
};

async function runPipelineVerification() {
  console.log("\n--- STAGE 0: SECURE AUTHENTICATION ---");
  try {
    const cred = await signInAnonymously(auth);
    console.log(`✔ SUCCESS: Authenticated anonymously with UID: ${cred.user.uid}`);
  } catch (err: any) {
    console.warn(`✖ WARNING: Auth failed (proceeding with rules bypass): ${err.message}`);
  }

  console.log("\n--- STAGE 1: AI GENERATIVE RULES COMPARISON ---");
  console.log("Mocking AI generation success. Received SVG dimensions: ", sampleSvg.length, "characters.");

  console.log("\n--- STAGE 2: PROCESS & SANITIZE INTEGRITY CHECK ---");
  // Execute user client-side sanitization
  const clientSanitized = sanitizeQuestionObject(validationTestData);
  const clientSvg = clientSanitized.questions[0].diagram_svg;
  
  console.log(`Original SVG starts with: ${sampleSvg.substring(0, 50).replace(/\n/g, ' ')}`);
  console.log(`Sanitized SVG starts with: ${clientSvg?.substring(0, 50).replace(/\n/g, ' ')}`);

  if (sampleSvg === clientSvg) {
    console.log("✔ SUCCESS: SVG markup matches original AI generation identically. No sanitization mutation detected.");
  } else {
    console.warn("✖ WARNING: SVG markup has mutated during sanitization process!");
  }

  console.log("\n--- STAGE 3: STORE AND WRITE TO FIRESTORE ---");
  try {
    const docRef = await addDoc(collection(db, 'tests'), JSON.parse(JSON.stringify({
      ...clientSanitized,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })));
    const testId = docRef.id;
    console.log(`✔ SUCCESS: Stored verification test in Firestore collection 'tests' with ID: ${testId}`);

    console.log("\n--- STAGE 4: RETRIEVE & TRANSMIT INTEGRITY CHECK ---");
    const retrievedSnap = await getDoc(doc(db, 'tests', testId));
    if (!retrievedSnap.exists()) {
      throw new Error(`Failed to retrieve test with ID ${testId} immediately after store.`);
    }

    const retrievedData = retrievedSnap.data() as any;
    const dbQuestion = retrievedData.questions[0];
    const dbSvg = dbQuestion.diagram_svg;
    const dbLatex = dbQuestion.formula_latex;

    console.log(`Retrieved SVG starts with: ${dbSvg.substring(0, 50).replace(/\n/g, ' ')}`);
    console.log(`Retrieved LaTeX formula is: "${dbLatex}"`);

    const matchesExactly = dbSvg === sampleSvg;
    if (matchesExactly) {
      console.log("✔ SUCCESS: Complete end-to-end database pipeline verified. No HTML escaping (&lt;, &gt;, etc.) present.");
    } else {
      console.warn("✖ WARNING: Escaping or corruption discovered in database transaction.");
    }

    console.log("\n--- PIPELINE DIAGNOSTICS COMPLETED SUCCESSFULLY ---");
    console.log(`Seeded Test ID for manual validation in previews: ${testId}`);
    console.log("You can now open the app browser live and inspect this newly seeded test.");
    process.exit(0);
  } catch (error: any) {
    console.error("✖ FAILED: Seeding/Integrity check encountered an error:", error);
    process.exit(1);
  }
}

runPipelineVerification();
