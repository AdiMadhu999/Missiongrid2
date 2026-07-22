import { execSync } from "child_process";
const token = process.env.GITHUB_TOKEN;
const owner = "AdiMadhu999";
const repo = "Missiongrid2";

if (!token) {
    console.error("No GITHUB_TOKEN environment variable found.");
    process.exit(1);
}

try {
    console.log("Setting remote origin...");
    try {
        execSync('git remote add origin https://github.com/AdiMadhu999/Missiongrid2.git');
    } catch {
        // remote might already exist
    }

    console.log("Staging changes...");
    execSync('git add -A');
    
    try {
        console.log("Committing changes...");
        execSync('git commit -m "feat: updated study material PDF stream downloader, interactive PDF previewer, and firebase config"');
    } catch {
        console.log("Nothing new to commit or commit already done.");
    }
    
    console.log("Setting authenticated remote URL...");
    const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
    execSync(`git remote set-url origin "${remoteUrl}"`);
    
    console.log("Pushing to GitHub...");
    execSync('git push -u origin main --force', { stdio: "inherit" });
    console.log("Successfully pushed to GitHub! This will trigger the APK compilation and Firebase deployment on GitHub Actions.");
} catch(e: any) {
    console.error("Push failed:", e.message || String(e));
} finally {
    try {
        // Restore clean remote URL to avoid saving credentials in git config
        execSync(`git remote set-url origin https://github.com/AdiMadhu999/Missiongrid2.git`);
    } catch {}
}

