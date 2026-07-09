const fs = require('fs');
const { execSync } = require('child_process');

let version = '1.0.54';
let buildVersionCode = 54;

// Use deterministic git commit count for versioning to avoid out-of-sync builds
let commitCount = 74; // Fallback matching current commit count on main (incremented to 74 for new version 1.0.54)
try {
  const countStr = execSync('git rev-list --count HEAD').toString().trim();
  const count = parseInt(countStr, 10);
  if (!isNaN(count) && count > 74) {
    commitCount = count;
  }
} catch (e) {
  console.log('Could not count commits, using fallback');
}

// Map commit count to version (74 commits -> version 1.0.54, code 54)
const patch = commitCount - 20;
version = `1.0.${patch}`;
buildVersionCode = patch;

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

// 2. Update android/app/build.gradle with the new version code
try {
  const gradlePath = 'android/app/build.gradle';
  if (fs.existsSync(gradlePath)) {
    let gradleContent = fs.readFileSync(gradlePath, 'utf8');
    gradleContent = gradleContent.replace(/versionCode\s+\d+/, `versionCode ${buildVersionCode}`);
    gradleContent = gradleContent.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
    fs.writeFileSync(gradlePath, gradleContent, 'utf8');
    console.log(`[Version Generator] Updated build.gradle to versionCode ${buildVersionCode}, versionName ${version}`);
  }
} catch (e) {
  console.log('Could not update build.gradle', e);
}

console.log(`[Version Generator] Generated src/version.ts with Version: ${version}, Commit: ${gitCommit}, BuildTime: ${buildTime}`);
