const fs = require('fs');
let code = fs.readFileSync('src/services/users.ts', 'utf8');

code = code.replace(
  /const uidToUpdate = pubSnap\.exists\(\) \? pubSnap\.data\(\)\.uid : null;/g,
  "const uidToUpdate = pubSnap.exists() ? (pubSnap.data() as any).uid : null;"
);

fs.writeFileSync('src/services/users.ts', code);
console.log("Patched users.ts uid reference again");
