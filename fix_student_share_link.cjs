const fs = require('fs');
let content = fs.readFileSync('src/screens/test/MentorTestList.tsx', 'utf8');

content = content.replace(
  'link = `${window.location.origin}/test/${test.id}`;',
  'link = `${window.location.origin}/app/tests/attempt/${test.id}`;'
);

fs.writeFileSync('src/screens/test/MentorTestList.tsx', content);
