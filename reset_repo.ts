import { execSync } from "child_process";
try {
    execSync("git fetch origin");
    execSync("git reset --hard origin/main");
    console.log("Reset to origin/main");
} catch(e) {
    console.error("Failed:", e);
}
