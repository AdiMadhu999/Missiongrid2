const fs = require('fs');

let content = fs.readFileSync('server_jobs.ts', 'utf8');

const additionalFunctions = `
export async function loadJob(jobId: string): Promise<JobState | null> {
  try {
    const docRef = doc(db, "ai_jobs", jobId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as JobState;
    }
  } catch (err) {
    console.error("Failed to load job from Firestore", err);
  }
  return null;
}

export async function saveJob(jobId: string, job: JobState) {
  try {
    await setDoc(doc(db, "ai_jobs", jobId), job);
  } catch (err) {
    console.error("Failed to save job to Firestore", err);
  }
}

export async function deleteJob(jobId: string) {
  try {
    await deleteDoc(doc(db, "ai_jobs", jobId));
  } catch (err) {
    console.error("Failed to delete job from Firestore", err);
  }
}
`;

content = content.replace(/export async function saveAllJobs\(jobs: Record<string, JobState>\) \{([\s\S]*?)\n\}\n\}/g, "export async function saveAllJobs(jobs: Record<string, JobState>) {$1\n}\n}" + additionalFunctions);

fs.writeFileSync('server_jobs.ts', content, 'utf8');
console.log('done');
