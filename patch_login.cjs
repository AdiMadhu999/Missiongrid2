const fs = require('fs');
let code = fs.readFileSync('src/services/auth.ts', 'utf8');

code = code.replace(
  "  loginWithMobileAndPassword: async (mobile: string, password: string, role: 'student' | 'mentor' | 'examiner', verificationMethod?: 'sms' | 'pin'): Promise<any> => {",
  "  loginWithMobileAndPassword: async (mobile: string, password: string, role: 'student' | 'mentor' | 'examiner', verificationMethod?: 'sms' | 'pin'): Promise<any> => {\n    // Ensure anonymous auth so we can query users_private\n    if (!auth.currentUser) { await signInAnonymously(auth); }"
);

fs.writeFileSync('src/services/auth.ts', code);
console.log("Patched auth.ts loginWithMobileAndPassword");
