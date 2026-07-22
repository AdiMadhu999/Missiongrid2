import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

// AI Resiliency Tracker and Pool Management

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const poolStats = {
  activeKeyIndex: 0,
  lastSuccessfulKey: "None",
  availableKeysCount: 0,
  lastSuccessTimestamp: "Never",
  lastError: "None",
  totalRequests: 0,
  failedRequests: 0,
  keyUsage: {} as Record<string, number>
};

export const DEFAULT_MODEL = "gemini-3.5-flash"; // Use supported flash model
export const FALLBACK_MODEL = "gemini-flash-latest"; // Reliable fallback
export const PRO_MODEL = "gemini-3.5-flash"; // For complex tasks without forcing paid flows

export const getPoolKeys = () => {
  const keys: string[] = [];
  
  // Try loading a custom API key configured inside the application budget dashboard
  try {
    const budgetPath = path.join(process.cwd(), "ai_budget.json");
    if (fs.existsSync(budgetPath)) {
      const budget = JSON.parse(fs.readFileSync(budgetPath, "utf-8"));
      if (budget && budget.customGeminiApiKey && budget.customGeminiApiKey.trim() !== "") {
        keys.push(budget.customGeminiApiKey.trim());
      }
    }
  } catch (err) {
    console.warn("[Resiliency] Could not read custom API key from budget config:", err);
  }

  // Fall back / append pool keys
  const envKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY
  ].filter((k): k is string => !!k && k.trim() !== "" && k !== "MY_GEMINI_API_KEY");

  keys.push(...envKeys);
  
  // Clean keys (remove potential quotes if user pasted them poorly)
  const cleanedKeys = keys.map(k => k.replace(/['"]/g, '').trim());
  return Array.from(new Set(cleanedKeys)); // Unique keys
};

// Initialize pool size
poolStats.availableKeysCount = getPoolKeys().length;

console.log(`[Resiliency Init] Pool configured with ${poolStats.availableKeysCount} keys.`);

/**
 * Executes an AI operation with automatic failover and key rotation.
 */
export async function executeResilientAI<T>(
  operation: (ai: GoogleGenAI) => Promise<T>,
  context: string = "general"
): Promise<T> {
  const keys = getPoolKeys();
  if (keys.length === 0) {
    const error = "AI Service Temporarily Unavailable. No valid Gemini API keys are configured in environment variables (GEMINI_API_KEY). Please contact administrator.";
    poolStats.lastError = `[${new Date().toISOString()}] No keys configured.`;
    console.error(`[Resiliency] FATAL: ${error}`);
    throw new Error(error);
  }

  let lastError: any = null;
  // Try all keys in the pool starting from the last known successful one
  for (let i = 0; i < keys.length; i++) {
    const currentIndex = (poolStats.activeKeyIndex + i) % keys.length;
    const currentKey = keys[currentIndex];
    
    try {
      const ai = new GoogleGenAI({
        apiKey: currentKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      poolStats.totalRequests++;
      // console.log(`[Resiliency] Attempting request with key index ${currentIndex} (${currentKey.substring(0, 6)}...)`);
      const result = await operation(ai);
      
      // Success! Update stats
      if (poolStats.activeKeyIndex !== currentIndex) {
        console.log(`[Resiliency] Switched to healthy key at index ${currentIndex}`);
      }
      poolStats.activeKeyIndex = currentIndex; // Stick with successful key
      poolStats.lastSuccessfulKey = `${currentKey.substring(0, 4)}...${currentKey.substring(currentKey.length - 4)}`;
      poolStats.lastSuccessTimestamp = new Date().toISOString();
      poolStats.keyUsage[currentKey] = (poolStats.keyUsage[currentKey] || 0) + 1;
      
      return result;
    } catch (err: any) {
      lastError = err;
      poolStats.failedRequests++;
      const maskedKey = `${currentKey.substring(0, 4)}...`;
      const reason = err.message || JSON.stringify(err);
      
      // If the service is unavailable, wait briefly before trying next key or retrying
      if (reason.includes("503") || reason.includes("UNAVAILABLE")) {
        console.warn(`[Resiliency] Key ${maskedKey} FAILED with 503. Waiting...`);
        await sleep(1000 * (i + 1));
      }

      console.error(`[Resiliency] Key ${maskedKey} FAILED. Error: ${reason}`);
      poolStats.lastError = `[${new Date().toISOString()}] Key ${maskedKey} failed: ${reason.substring(0, 150)}`;
      
      // Continue to next key
    }
  }

  // All keys failed
  let customErrorMsg = lastError?.message || 'Unknown error';
  if (
    customErrorMsg.includes("prepayment credits are depleted") || 
    customErrorMsg.includes("prepay") || 
    customErrorMsg.includes("RESOURCE_EXHAUSTED") || 
    customErrorMsg.includes("429") ||
    customErrorMsg.includes("RESOURCE_EXHAUSTED")
  ) {
    customErrorMsg = "Your Google Gemini API Key prepayment credits are depleted! Please top up your Google AI Studio account billing, or configure a healthy key (GEMINI_API_KEY) in settings.";
  }
  const finalError = `AI Service Temporarily Unavailable. (Pool Exhausted: ${customErrorMsg})`;
  console.error(`[Resiliency] ALL KEYS FAILED. Final error: ${finalError}`);
  throw new Error(finalError);
}

/**
 * Health check to verify at least one key works
 */
export async function runAIHealthCheck(): Promise<boolean> {
  console.log("[Resiliency] Running AI Health Check...");
  try {
    const result = await executeResilientAI(async (ai) => {
      // Use standard content structure
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }]
      });
      return response;
    }, "health-check");
    console.log("[Resiliency] Health Check PASSED.");
    return true;
  } catch (err: any) {
    const errMsg = err.message || JSON.stringify(err);
    if (errMsg.includes("429") || errMsg.includes("prepay") || errMsg.includes("depleted") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        const warningMsg = `Spending cap exceeded or prepayment credits depleted: ${errMsg}`;
        console.error(`[Resiliency] Health Check FAILED: ${warningMsg}`);
        poolStats.lastError = `[${new Date().toISOString()}] Health Check failed: ${warningMsg}`;
    } else {
        console.error(`[Resiliency] Health Check FAILED: ${errMsg}`);
        poolStats.lastError = `[${new Date().toISOString()}] Health Check failed: ${errMsg}`;
    }
    return false;
  }
}
