const fs = require('fs');
let code = fs.readFileSync('src/services/firebase.ts', 'utf8');

code = code.replace(
  "/* experimentalForceLongPolling: true */",
  "experimentalForceLongPolling: Capacitor.isNativePlatform() ? true : undefined"
);

code = code.replace(
  "/* experimentalForceLongPolling: true */",
  "experimentalForceLongPolling: Capacitor.isNativePlatform() ? true : undefined"
);

fs.writeFileSync('src/services/firebase.ts', code);
console.log("Patched firebase.ts for long polling");
