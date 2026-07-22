const fs = require('fs');
let code = fs.readFileSync('src/components/feed/FeedCards.tsx', 'utf8');

const targetStr = `    const canEditOrDelete = userProfile?.id === itemOwnerId || isMentor;`;
const replaceStr = `    const canEditOrDelete = (userProfile?.id === itemOwnerId) || (userProfile?.uid === itemOwnerId) || isMentor;`;
code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/components/feed/FeedCards.tsx', code);
console.log("Patched canEditOrDelete logic successfully");
