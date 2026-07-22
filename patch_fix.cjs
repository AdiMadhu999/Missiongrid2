const fs = require('fs');
let code = fs.readFileSync('src/screens/mentor/MentorPlace.tsx', 'utf8');

code = code.replace(
  /const \[view, setView\] = useState<'list' \| 'review' \| 'check'>\(initialView as any\);\|const \[view, setView\] = useState<'list' \| 'review' \| 'check'>\(initialView as any\);/g,
  "const [view, setView] = useState<'list' | 'review' | 'check'>(initialView as any);"
);

fs.writeFileSync('src/screens/mentor/MentorPlace.tsx', code);
console.log("Fixed syntax error");
