const fs = require('fs');
let code = fs.readFileSync('src/screens/create/ActivityCreationScreen.tsx', 'utf8');

code = code.replace("authorPhoto: userProfile?.photoURL", "authorPhoto: userProfile?.photoUrl");

fs.writeFileSync('src/screens/create/ActivityCreationScreen.tsx', code);
console.log("Patched creation photoUrl successfully");
