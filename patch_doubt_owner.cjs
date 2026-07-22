const fs = require('fs');
let code = fs.readFileSync('src/components/feed/FeedCards.tsx', 'utf8');

const targetStr1 = `    const canView = !isPrivate || userProfile?.id === item.authorId || isMentor;`;
const replaceStr1 = `    const itemOwnerId = item.authorId || item.studentId || item.uid;
    const canView = !isPrivate || userProfile?.id === itemOwnerId || isMentor;`;
code = code.replace(targetStr1, replaceStr1);

const targetStr2 = `    const canEditOrDelete = item.authorId === userProfile?.id || isMentor;`;
const replaceStr2 = `    const canEditOrDelete = userProfile?.id === itemOwnerId || isMentor;`;
code = code.replace(targetStr2, replaceStr2);

fs.writeFileSync('src/components/feed/FeedCards.tsx', code);
console.log("Patched DoubtCard owner successfully");
