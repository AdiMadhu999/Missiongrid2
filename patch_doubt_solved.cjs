const fs = require('fs');
let code = fs.readFileSync('src/components/feed/FeedCards.tsx', 'utf8');

const targetStr = `        if (isNowSolved && item.authorId !== userProfile?.id) {
            sendNotification(item.authorId, userProfile!.uid, 'Solved', item.id, 'Doubt Solved', \`Your doubt "\${item.title}" was marked as solved.\`);
        }`;
const replaceStr = `        if (isNowSolved && itemOwnerId !== userProfile?.id) {
            sendNotification(itemOwnerId, userProfile!.uid, 'Solved', item.id, 'Doubt Solved', \`Your doubt "\${item.title}" was marked as solved.\`);
        }`;
code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/components/feed/FeedCards.tsx', code);
console.log("Patched DoubtCard toggleSolved successfully");
