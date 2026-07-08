import fetch from "node-fetch";

async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/ai/budget-status");
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
