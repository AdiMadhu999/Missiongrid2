import { GoogleGenAI, Type } from "@google/genai";

async function test(modelName) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ text: "Hello" }]
    });
    console.log(modelName, "SUCCESS", response.text);
  } catch (err) {
    console.error(modelName, "FAILED", err.message);
  }
}

async function run() {
  await test("gemini-2.5-flash");
  await test("gemini-1.5-pro");
  await test("gemini-1.5-pro-001");
  await test("gemini-2.0-flash");
}

run();
