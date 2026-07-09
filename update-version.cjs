const fs = require('fs');
const { execSync } = require('child_process');

let version = '1.0.55';
let buildVersionCode = 58;

try {
  const gradlePath = 'android/app/build.gradle';
  if (fs.existsSync(gradlePath)) {
    let gradleContent = fs.readFileSync(gradlePath, 'utf8');
    const versionMatch = gradleContent.match(/versionName\s+"([^"]+)"/);
    const codeMatch = gradleContent.match(/versionCode\s+(\d+)/);
    if (versionMatch) version = versionMatch[1];
    if (codeMatch) buildVersionCode = parseInt(codeMatch[1], 10);
  }
} catch (e) {
  console.log('Could not read build.gradle', e);
}

let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.log('Could not retrieve git commit hash');
}

const buildTime = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';

const content = `export const APP_VERSION = "${version}";
export const GIT_COMMIT = "${gitCommit}";
export const BUILD_TIMESTAMP = "${buildTime}";
`;
fs.writeFileSync('src/version.ts', content, 'utf8');

// Also write to public/version.json for CDN update checks
try {
  if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
  }
  fs.writeFileSync('public/version.json', JSON.stringify({ version: version }), 'utf8');
  console.log(`[Version Generator] Generated public/version.json with version: ${version}`);
} catch (e) {
  console.log('Could not write public/version.json', e);
}

console.log(`[Version Generator] Generated src/version.ts with Version: ${version}, Commit: ${gitCommit}, BuildTime: ${buildTime}`);
