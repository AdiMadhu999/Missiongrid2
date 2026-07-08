const fs = require('fs');
let code = fs.readFileSync('.github/workflows/android_build.yml', 'utf8');

code = code.replace(
  "gh release create latest \\",
  "APP_VER=$(grep versionName android/app/build.gradle | awk '{print $2}' | tr -d '\"')\n          cp android/app/build/outputs/apk/release/app-release.apk android/app/build/outputs/apk/release/app-release-${APP_VER}.apk\n          gh release create latest \\\n            android/app/build/outputs/apk/release/app-release-${APP_VER}.apk \\"
);

fs.writeFileSync('.github/workflows/android_build.yml', code);
console.log("Patched YML");
