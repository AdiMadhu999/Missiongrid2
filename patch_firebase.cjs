const fs = require('fs');
let code = fs.readFileSync('src/services/firebase.ts', 'utf8');

code = code.replace(
  /\} catch \(err\) \{\n    dbInstance = initializeFirestore\(app, \{\n      experimentalForceLongPolling: Capacitor.isNativePlatform\(\) \? true : undefined\n    \}, '\(default\)'\);\n  \}/,
  '} catch (err) {\n    dbInstance = initializeFirestore(app, {\n      experimentalForceLongPolling: Capacitor.isNativePlatform() ? true : undefined\n    });\n  }'
);

fs.writeFileSync('src/services/firebase.ts', code);
console.log("Patched firebase.ts databaseId issue");
