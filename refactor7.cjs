const fs = require('fs');

let content = fs.readFileSync('server_jobs.ts', 'utf8');
content = content.replace(/function boxJobOutput\(jobId: string, fileId: string, result: BatchResult\) \{/g, 'async function boxJobOutput(jobId: string, fileId: string, result: BatchResult) {');
fs.writeFileSync('server_jobs.ts', content, 'utf8');

// Also make sure server.ts exports these functions
let s = fs.readFileSync('server.ts', 'utf8');
s = s.replace(/loadAllJobs,\n  saveAllJobs,\n  loadBudgetDetails/g, 'loadAllJobs,\n  saveAllJobs,\n  loadJob,\n  saveJob,\n  deleteJob,\n  loadBudgetDetails');
fs.writeFileSync('server.ts', s, 'utf8');

console.log('done');
