const fs = require('fs');
let content = fs.readFileSync('src/screens/test/TestCreateEdit.tsx', 'utf8');

content = content.replace(
  'onChange={(e) => onChange(setIsPublic)(e.target.checked)}',
  'onChange={(e) => { onChange(setIsPublic)(e.target.checked); if (e.target.checked && !shareableId) { const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let result = ""; for (let i = 0; i < 12; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); } setShareableId(result); } }}'
);

fs.writeFileSync('src/screens/test/TestCreateEdit.tsx', content);
