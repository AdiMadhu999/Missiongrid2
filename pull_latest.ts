import { execSync } from "child_process";
const token = process.env.GITHUB_TOKEN;
const owner = "AdiMadhu999";
const repo = "Missiongrid2";

if (!token) {
    console.error("No GITHUB_TOKEN environment variable found.");
    process.exit(1);
}

try {
    console.log("Setting authenticated remote URL for pulling...");
    const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
    execSync(`git remote set-url origin "${remoteUrl}"`);
    
    console.log("Configuring git user for automated merge...");
    execSync('git config user.name "AI Studio Assistant"');
    execSync('git config user.email "assistant@aistudio.google.com"');

    console.log("Pulling changes from main with rebase to keep history clean...");
    execSync('git pull origin main --rebase', { stdio: "inherit" });
    console.log("Successfully pulled remote changes!");
} catch(e: any) {
    console.error("Pull failed:", e.message || String(e));
} finally {
    // Restore clean remote URL to avoid saving credentials in git config
    execSync(`git remote set-url origin https://github.com/AdiMadhu999/Missiongrid2.git`);
}
