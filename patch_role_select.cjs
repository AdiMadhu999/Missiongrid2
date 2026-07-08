const fs = require('fs');
let code = fs.readFileSync('src/screens/mentor/StudentManagementModal.tsx', 'utf8');

code = code.replace(
  /onChange=\{e => setRole\(e.target.value\)\}/,
  'onChange={e => setRole(e.target.value as any)}'
);

fs.writeFileSync('src/screens/mentor/StudentManagementModal.tsx', code);
console.log("Patched role select in StudentManagementModal");
