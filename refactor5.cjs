const fs = require('fs');

let content = fs.readFileSync('./run_test.ts', 'utf8');
content = content.replace(/const jobs = loadAllJobs\(\);/g, 'const jobs = await loadAllJobs();');
content = content.replace(/saveAllJobs\(jobs\);/g, 'await saveAllJobs(jobs);');
content = content.replace(/const finalJobs = loadAllJobs\(\);/g, 'const finalJobs = await loadAllJobs();');
fs.writeFileSync('./run_test.ts', content, 'utf8');

let content2 = fs.readFileSync('./server_jobs.ts', 'utf8');
content2 = content2.replace(/const currentJobs = loadAllJobs\(\);/g, 'const currentJobs = await loadAllJobs();');
content2 = content2.replace(/saveAllJobs\(currentJobs\);/g, 'await saveAllJobs(currentJobs);');
content2 = content2.replace(/saveAllJobs\(loadAllJobs\(\)\);/g, 'await saveAllJobs(await loadAllJobs());');
content2 = content2.replace(/const jobs = loadAllJobs\(\);/g, 'const jobs = await loadAllJobs();');
fs.writeFileSync('./server_jobs.ts', content2, 'utf8');

console.log('done');
