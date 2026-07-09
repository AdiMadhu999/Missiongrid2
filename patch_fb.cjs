const fs = require('fs');
let code = fs.readFileSync('src/services/firebase.ts', 'utf8');

code = code.replace(
  /export const storage = getStorage\(app\);/g,
  "export const storage = getStorage(app, 'gs://mission-selection-ultimate.appspot.com');"
);

fs.writeFileSync('src/services/firebase.ts', code);
console.log("Patched firebase storage init");
