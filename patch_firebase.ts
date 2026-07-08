import fs from 'fs';

let content = fs.readFileSync('firebase.json', 'utf8');

const target = `"headers": [`;
const replacement = `"headers": [
      {
        "source": "**/*.apk",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      },`;

content = content.replace(target, replacement);
fs.writeFileSync('firebase.json', content);
