const fs = require('fs');
let code = fs.readFileSync('src/screens/create/ActivityCreationScreen.tsx', 'utf8');

code = code.replace("studentId: userProfile?.id,", "studentId: userProfile?.id, authorId: userProfile?.id, authorPhoto: userProfile?.photoURL,");

fs.writeFileSync('src/screens/create/ActivityCreationScreen.tsx', code);
console.log("Patched creation successfully");
