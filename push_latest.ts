import { execSync } from "child_process";
const token = process.env.GITHUB_TOKEN;
const owner = "AdiMadhu999";
const repo = "Missiongrid2";

if (!token) {
    console.error("No GITHUB_TOKEN environment variable found.");
    process.exit(1);
}

try {
    console.log("Staging changes...");
    execSync('git add -A');
    
    console.log("Committing changes...");
    execSync('git commit -m "perf(optimization): optimize applet load with lazy loading and high-performance user search indexing"');
    
    console.log("Setting remote URL...");
    const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
    execSync(`git remote set-url origin "${remoteUrl}"`);
    
    console.log("Pushing to GitHub...");
    execSync('git push origin main', { stdio: "inherit" });
    console.log("Successfully pushed to GitHub! This will trigger the APK compilation on GitHub Actions.");
} catch(e: any) {
    console.error("Push failed:", e.message || String(e));
} finally {
    // Restore clean remote URL to avoid saving credentials in git config
    execSync(`git remote set-url origin https://github.com/AdiMadhu999/Missiongrid2.git`);
}
