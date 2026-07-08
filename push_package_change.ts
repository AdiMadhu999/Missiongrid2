import { execSync } from "child_process";
const token = process.env.GITHUB_TOKEN;
const owner = "AdiMadhu999";
const repo = "MissionSelection";

if (!token) {
    console.error("No token");
    process.exit(1);
}

try {
    execSync('git add .');
    execSync('git commit -m "Fix: Change package name to com.adimadhu.missiongrid"');
    
    const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
    execSync(`git remote set-url origin "${remoteUrl}"`);
    execSync('git push -f origin main', { stdio: "inherit" });
    console.log("Pushed successfully.");
} catch(e) {
    console.error("Push failed:", e);
} finally {
    execSync(`git remote set-url origin https://github.com/${owner}/${repo}.git`);
}
