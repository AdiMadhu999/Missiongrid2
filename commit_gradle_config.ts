import { execSync } from "child_process";
try {
    execSync('git add android/app/build.gradle');
    execSync('git commit -m "Fix: Configure release signing in build.gradle"');
    console.log("Committed.");
} catch(e) {
    console.error("Failed:", e);
}
