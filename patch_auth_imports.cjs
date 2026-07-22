const fs = require('fs');
let code = fs.readFileSync('src/services/auth.ts', 'utf8');

code = code.replace(
  /import \{ signInWithPhoneNumber, signInAnonymously, signInWithCustomToken, ConfirmationResult \} from 'firebase\/auth';/g,
  "import { signInWithPhoneNumber, signInAnonymously, signInWithCustomToken, ConfirmationResult, setPersistence, browserLocalPersistence } from 'firebase/auth';"
);

fs.writeFileSync('src/services/auth.ts', code);
console.log("Patched auth.ts imports");
