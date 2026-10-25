import axios from "axios";

// Retry delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry Gemini API for temporary errors
const callGeminiWithRetry = async (apiUrl, body, config) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await axios.post(apiUrl, body, config);
    } catch (error) {
      const status = error.response?.status;

      if (![429, 503].includes(status) || attempt === 3) {
        throw error;
      }

      const delay = 1000 * 2 ** (attempt - 1);
      console.log(`Gemini busy (${status}). Retrying after ${delay}ms...`);
      await sleep(delay);
    }
  }
};

const geminiResponse = async (
  command,
  assistantName = "Assistant",
  userName = "User",
  language = "hindi"
) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing in .env");
    }

    const apiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

    const isEnglish = language === "english";

    const prompt = `
You are an intelligent, friendly AI virtual voice assistant named "${assistantName}", created by "${userName}".

The user speaks to you using natural voice commands (Hindi, Hinglish, or English).
Understand the user's intent and respond with a strictly valid JSON object.

Language Rule:
- Primary voice language requested: ${isEnglish ? "English" : "Hindi"}.
- ${
  isEnglish
    ? "Provide the 'response' field in clear, friendly spoken English."
    : "Provide the 'response' field in natural, conversational, polite spoken Hindi in Devanagari script (जैसे: 'हाँ, मैं गूगल खोल रही हूँ।', 'ज़रूर, मैं यह चला रही हूँ।', 'नमस्ते! मैं आपकी क्या मदद कर सकती हूँ?')."
}
- Keep the spoken response short, friendly, and natural for text-to-speech (1-2 short sentences maximum).
- If asked who created you, say you were created by ${userName}.

JSON structure to return:
{
  "type": "allowed-type",
  "userInput": "extracted clean search term or query (empty string if none)",
  "response": "spoken voice response"
}

Allowed types:
- "general": General conversation, knowledge questions, greetings, jokes, etc.
- "google-open": Open Google search homepage (e.g. "गूगल खोलो", "open google", "गूगल ओपन करो").
- "google-search": Web search query on Google. Put ONLY the search query in userInput.
- "youtube-open": Open YouTube homepage.
- "youtube-search": Search YouTube. Put only the search term in userInput.
- "youtube-play": Play a song/video on YouTube. Put only the song/video title or artist in userInput.
- "calculator-open": Open calculator.
- "instagram-open": Open Instagram.
- "facebook-open": Open Facebook.
- "whatsapp-open": Open WhatsApp Web.
- "gmail-open": Open Gmail.
- "github-open": Open GitHub or search GitHub.
- "maps-open": Open Google Maps or search location. Put location in userInput.
- "news-open": Open Google News or search news topic. Put topic in userInput.
- "wikipedia-open": Open Wikipedia or search topic. Put topic in userInput.
- "weather-show": Open weather or ask about weather. Put city/location in userInput if mentioned.
- "get-time": Current time inquiry.
- "get-date": Current date inquiry.
- "get-day": Day of the week inquiry.
- "get-month": Current month inquiry.

User command: ${command}
`;

    const result = await callGeminiWithRetry(
      apiUrl,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        timeout: 30000,
      }
    );

    const responseText =
      result.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error("Empty response from Gemini API");
    }

    const cleanedText = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error(
      "Gemini API Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export default geminiResponse;
