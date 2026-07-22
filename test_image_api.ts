import { executeResilientAI } from "./src/services/ai_resiliency.ts";

async function test() {
  const dummyImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
  try {
    const response = await executeResilientAI(async (ai) => {
      const parts = [
        {
          inlineData: {
            mimeType: "image/png",
            data: dummyImage
          }
        },
        { text: "Describe this image." }
      ];
      return ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: parts
      });
    });
    console.log("Success!");
    console.log(response.text);
  } catch (err: any) {
    console.error("Error:", err.message || err);
  }
}

test();
