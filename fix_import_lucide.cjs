const fs = require('fs');
let content = fs.readFileSync('src/screens/test/MentorTestList.tsx', 'utf8');
content = content.replace('  Share2,', '  Share2, Globe,');
fs.writeFileSync('src/screens/test/MentorTestList.tsx', content);
