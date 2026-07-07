const fs = require('fs');
let content = fs.readFileSync('./server_jobs.ts', 'utf8');

// I will split by "const JOBS_FILE =" and "export async function saveAllJobs("
// and replace the exact string.

const lines = content.split('\n');
let newLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const JOBS_FILE =')) {
    skip = true;
    newLines.push('const BUDGET_FILE = path.join(process.cwd(), "ai_budget.json");');
    newLines.push('export function clearJobCache(jobId: string) {}');
    
    // Add imports directly below here, or at the top. Let's add them at the top.
    
    newLines.push('import { db } from "./src/services/firebase.ts";');
    newLines.push('import { doc, getDoc, setDoc, getDocs, collection, deleteDoc } from "firebase/firestore";');
    
    newLines.push(`
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

export async function saveAllJobs(jobs: Record<string, JobState>) {
  for (const [jobId, job] of Object.entries(jobs)) {
    try {
      await setDoc(doc(db, "ai_jobs", jobId), job);
    } catch (err) {
      console.error("Failed to save job to Firestore", err);
    }
  }
}
`);
    continue;
  }
  
  if (skip) {
    if (lines[i] === '  } catch (err) {' && lines[i+1] && lines[i+1].includes('console.error("Failed to sync background jobs to disk", err);')) {
      // we need to skip until the end of the function
    }
    // Let's just find the end of saveAllJobs
    // Wait, let's just skip until we find "export function loadBudgetDetails()"
    if (lines[i].includes('export function loadBudgetDetails()')) {
      skip = false;
      newLines.push(lines[i]);
    }
  } else {
    // Top of file imports
    newLines.push(lines[i]);
  }
}

fs.writeFileSync('./server_jobs.ts', newLines.join('\n'), 'utf8');
console.log('done');
