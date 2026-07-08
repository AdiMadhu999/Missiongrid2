import { execSync } from "child_process";
try {
    console.log(execSync("git pull origin main", {stdio: "pipe"}).toString());
} catch(e: any) {
    console.error("Pull failed:", e.stderr ? e.stderr.toString() : e.message);
}
