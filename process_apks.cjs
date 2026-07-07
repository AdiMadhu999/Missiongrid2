const { execSync } = require('child_process');
const fs = require('fs');

if (fs.existsSync('app-release.zip')) {
  console.log('Unzipping app-release.zip...');
  execSync('unzip -o app-release.zip -d public/');
}
if (fs.existsSync('app-debug.zip')) {
  console.log('Unzipping app-debug.zip...');
  execSync('unzip -o app-debug.zip -d public/');
}

console.log('Done processing APKs.');
