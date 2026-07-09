import { execSync } from "child_process";
try {
    console.log(execSync("git remote -v").toString());
} catch(e) {
    console.error("Failed:", e);
}
