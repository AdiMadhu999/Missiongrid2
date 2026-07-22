const fs = require('fs');
let s = fs.readFileSync('server_jobs.ts', 'utf8');
s = s.replace(/boxJobOutput\(jobId, file\.id, imgRes\);/g, 'await boxJobOutput(jobId, file.id, imgRes);');
fs.writeFileSync('server_jobs.ts', s, 'utf8');
