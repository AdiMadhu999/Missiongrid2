const fs = require('fs');
let code = fs.readFileSync('src/services/users.ts', 'utf8');

code = code.replace(
  /let studentUid = \(data as any\)\.uid;/,
  "let studentUid = (data as any).uid || (privSnap.exists() ? privSnap.data().uid : '');"
);

fs.writeFileSync('src/services/users.ts', code);
console.log("Patched users.ts uid reference");
