const fs = require('fs');
let content = fs.readFileSync('src/components/feed/FeedCards.tsx', 'utf8');

content = content.replace(
  '/app/test/attempt/',
  '/app/tests/attempt/'
);

fs.writeFileSync('src/components/feed/FeedCards.tsx', content);
