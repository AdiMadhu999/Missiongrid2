const fs = require('fs');
let code = fs.readFileSync('src/services/auth.ts', 'utf8');

code = code.replace(
  "registerWithMobileAndPassword: async (mobile: string, password: string, name: string): Promise<any> => {",
  "registerWithMobileAndPassword: async (mobile: string, password: string, name: string, batchId?: string, photoUrl?: string): Promise<any> => {"
);

code = code.replace(
  "const newUser = await createUserProfile({\n            mobile: sanitizedMobile,\n            uid: uid,\n            role: 'student',\n            name: name || 'Student',\n            pin: password,\n            status: 'active'\n        });",
  "const newUser = await createUserProfile({\n            mobile: sanitizedMobile,\n            uid: uid,\n            role: 'student',\n            name: name || 'Student',\n            pin: password,\n            status: 'active',\n            batchId: batchId || 'Aspirants',\n            photoUrl: photoUrl || ''\n        });"
);

fs.writeFileSync('src/services/auth.ts', code);
console.log("Patched auth.ts");
