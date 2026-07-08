const fs = require('fs');
let code = fs.readFileSync('src/services/firebase.ts', 'utf8');

code = code.replace(
  /export const storage = getStorage\(app, 'gs:\/\/mission-selection-ultimate\.appspot\.com'\);/g,
  "export const storage = getStorage(app);"
);

code = code.replace(
  /dbInstance = getFirestore\(app, '\(default\)'\);/g,
  "dbInstance = getFirestore(app);"
);

code = code.replace(
  /export const db = dbInstance;/g,
  "export const db = dbInstance || getFirestore(app);"
);

fs.writeFileSync('src/services/firebase.ts', code);
console.log("Patched firebase db init");
