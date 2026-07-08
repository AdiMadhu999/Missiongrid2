const fs = require('fs');
let content = fs.readFileSync('./server_jobs.ts', 'utf8');

// Replace everything related to loadAllJobs, saveAllJobs, base64DataCache
const newContent = content.replace(/const JOBS_FILE = path\.join\(process\.cwd\(\), "ai_jobs\.json"\);[\s\S]*?export async function saveAllJobs\(jobs: Record<string, JobState>\) \{[\s\S]*?fs\.writeFileSync\(JOBS_FILE, JSON\.stringify\(safeData, null, 2\)\);\n  \} catch \(err\) \{\n    console\.error\("Failed to save jobs file\.", err\);\n  \}\n\}/g, `const BUDGET_FILE = path.join(process.cwd(), "ai_budget.json");

export function clearJobCache(jobId: string) {
  // Deprecated, no longer using base64 cache
}

import { db } from "./src/services/firebase.ts";
import { doc, getDoc, setDoc, getDocs, collection, deleteDoc } from "firebase/firestore";

// Load background jobs from local storage file
export async function loadAllJobs(): Promise<Record<string, JobState>> {
  try {
    const jobsRef = collection(db, "ai_jobs");
    const snap = await getDocs(jobsRef);
    const jobs: Record<string, JobState> = {};
    snap.forEach(d => {
      jobs[d.id] = d.data() as JobState;
    });
    return jobs;
  } catch (err) {
    console.error("Failed to load jobs from Firestore", err);
    return {};
  }
}

// Save background jobs
export async function saveAllJobs(jobs: Record<string, JobState>) {
  for (const [jobId, job] of Object.entries(jobs)) {
    try {
      // In a real application, you might only save the updated jobs.
      // We assume jobs passed here are fully populated.
      await setDoc(doc(db, "ai_jobs", jobId), job);
    } catch (err) {
      console.error("Failed to save job to Firestore", err);
    }
  }
}`);

fs.writeFileSync('./server_jobs.ts', newContent, 'utf8');
console.log('done');
