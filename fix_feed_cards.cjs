const fs = require('fs');
let content = fs.readFileSync('src/components/feed/FeedCards.tsx', 'utf8');
content = content.replace(
  'onClick={() => window.location.href = `/app/test/attempt/${item.id}`}',
  'onClick={() => window.location.href = `/app/test/attempt/${item.testId || item.id}`}'
);
fs.writeFileSync('src/components/feed/FeedCards.tsx', content);
