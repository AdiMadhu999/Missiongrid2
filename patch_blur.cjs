const fs = require('fs');
let code = fs.readFileSync('src/components/MainLayout.tsx', 'utf8');
code = code.replace(/backdrop-blur-xl/g, '');
code = code.replace(/bg-white\/95/g, 'bg-white');
fs.writeFileSync('src/components/MainLayout.tsx', code);
console.log("Patched MainLayout");
