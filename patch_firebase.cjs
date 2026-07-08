const fs = require('fs');
let code = fs.readFileSync('src/services/firebase.ts', 'utf8');

code = code.replace(
  "persistentMultipleTabManager()",
  "persistentSingleTabManager()"
);

code = code.replace(
  "import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, setLogLevel } from 'firebase/firestore';",
  "import { initializeFirestore, getFirestore, persistentLocalCache, persistentSingleTabManager, setLogLevel } from 'firebase/firestore';"
);

code = code.replace(/experimentalForceLongPolling: true/g, "/* experimentalForceLongPolling: true */");

fs.writeFileSync('src/services/firebase.ts', code);
console.log("Patched firebase.ts");
