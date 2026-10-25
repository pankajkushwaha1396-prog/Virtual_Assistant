import "dotenv/config";
import geminiResponse from "./gemini.js";

async function testGemini() {
  try {
    console.log("Testing Gemini Assistant with Hindi query...");
    const result = await geminiResponse(
      "नमस्ते, तुम क्या-क्या कर सकते हो?",
      "शिफरा",
      "पंकज",
      "hindi"
    );
    console.log("Response:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Test error:", error);
  }
}

testGemini();
