import fetch from "node-fetch";

async function test() {
  try {
    const res = await fetch("https://ais-dev-4lc74fjhivgouuxt4jkrwg-977053100479.asia-southeast1.run.app/api/ai/budget-status");
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
