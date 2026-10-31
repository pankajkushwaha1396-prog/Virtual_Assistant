import axios from "axios";

// Retry delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry Gemini API for temporary errors or fallback models
const callGeminiWithRetry = async (modelName, body, apiKey) => {
  const models = [
    modelName,
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
  ];

  for (const model of models) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await axios.post(apiUrl, body, {
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          timeout: 25000,
        });
        return res;
      } catch (error) {
        const status = error.response?.status;

        if (status === 404) {
          console.warn(`Model ${model} not found (404), trying fallback...`);
          break;
        }

        if (![429, 503].includes(status) || attempt === 2) {
          if (models.indexOf(model) === models.length - 1) {
            throw error;
          }
          break;
        }

        const delay = 1000 * 2 ** (attempt - 1);
        console.log(`Gemini busy (${status}). Retrying after ${delay}ms...`);
        await sleep(delay);
      }
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

    const preferredModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const isEnglish = language === "english";

    const prompt = `
You are an intelligent, friendly AI virtual voice assistant named "${assistantName}", created by "${userName}".

The user speaks to you using natural voice commands (Hindi, Hinglish, or English).
Understand the user's intent and respond with a strictly valid JSON object.

Language Rule:
- Primary voice language requested: ${isEnglish ? "English" : "Hindi"}.
- ${
      isEnglish
        ? "Provide the 'response' field in clear, friendly spoken English (e.g., 'Sure, opening Flipkart for you.', 'Here is what you requested.')."
        : "Provide the 'response' field in natural, conversational, polite spoken Hindi in Devanagari script (जैसे: 'हाँ, मैं फ्लिपकार्ट खोल रही हूँ।', 'ज़रूर, मैं अमेज़न पर खोज रही हूँ।', 'गूगल खोल दिया गया है।', 'नमस्ते! मैं आपकी क्या मदद कर सकती हूँ?')."
    }
- Keep the spoken response short, friendly, and natural for text-to-speech (1-2 short sentences maximum).
- If asked who created you, say you were created by ${userName}.

JSON structure to return:
{
  "type": "allowed-type",
  "userInput": "extracted clean search term, product name, or website query (empty string if none)",
  "targetUrl": "optional direct https URL if opening a specific website or domain",
  "siteName": "optional friendly site name like Flipkart, Amazon, Netflix, etc.",
  "response": "spoken voice response"
}

Allowed types:
- "flipkart-open": Open Flipkart homepage (e.g. "फ्लिपकार्ट खोलो", "open flipkart", "फ्लिपकार्ट चलाओ").
- "flipkart-search": Search products on Flipkart (e.g. "फ्लिपकार्ट पर जूते दिखाओ", "search shoes on flipkart", "flipkart mobile search"). Put ONLY product/search query in userInput.
- "amazon-open": Open Amazon India homepage (e.g. "अमेज़न खोलो", "open amazon").
- "amazon-search": Search products on Amazon. Put search query in userInput.
- "meesho-open": Open Meesho (e.g. "meesho खोलो", "open meesho").
- "meesho-search": Search Meesho. Put query in userInput.
- "myntra-open": Open Myntra fashion store (e.g. "myntra खोलो", "open myntra").
- "myntra-search": Search Myntra. Put query in userInput.
- "swiggy-open": Open Swiggy food delivery (e.g. "swiggy खोलो", "open swiggy").
- "zomato-open": Open Zomato food delivery (e.g. "zomato खोलो", "open zomato").
- "blinkit-open": Open Blinkit grocery delivery.
- "netflix-open": Open Netflix.
- "netflix-search": Search movie or show on Netflix. Put title in userInput.
- "spotify-open": Open Spotify music.
- "spotify-search": Search song/artist on Spotify. Put song/artist in userInput.
- "hotstar-open": Open Disney+ Hotstar or JioCinema.
- "chatgpt-open": Open ChatGPT (e.g. "chatgpt खोलो", "open chatgpt").
- "twitter-open": Open Twitter/X (e.g. "twitter खोलो", "open twitter", "x खोलो").
- "linkedin-open": Open LinkedIn.
- "reddit-open": Open Reddit.
- "pinterest-open": Open Pinterest.
- "cricbuzz-open": Open Cricbuzz live cricket scores.
- "google-open": Open Google search homepage (e.g. "गूगल खोलो", "open google").
- "google-search": Web search query on Google. Put ONLY search query in userInput.
- "youtube-open": Open YouTube homepage.
- "youtube-search": Search YouTube. Put only search term in userInput.
- "youtube-play": Play song/video on YouTube. Put only song title/artist in userInput.
- "calculator-open": Open calculator.
- "instagram-open": Open Instagram.
- "facebook-open": Open Facebook.
- "whatsapp-open": Open WhatsApp Web.
- "gmail-open": Open Gmail.
- "github-open": Open GitHub or search GitHub.
- "maps-open": Open Google Maps or search location. Put location in userInput.
- "news-open": Open Google News or search news. Put topic in userInput.
- "wikipedia-open": Open Wikipedia or search topic. Put topic in userInput.
- "weather-show": Open weather or ask about weather. Put city in userInput if mentioned.
- "website-open": Open ANY OTHER website or domain (e.g. "open canva", "open figma", "open stackoverflow", "open cricbuzz.com", "open espn"). Put clean full URL like "https://www.canva.com" in targetUrl, site name in siteName.
- "timer-open": Set timer or alarm or countdown. Put duration in userInput (e.g., "5 minutes").
- "notes-open": Open notes or memo.
- "translate-open": Translate language or sentence. Put text in userInput.
- "get-time": Current time inquiry.
- "get-date": Current date inquiry.
- "get-day": Day of the week inquiry.
- "get-month": Current month inquiry.
- "general": General conversation, knowledge questions, greetings, jokes, etc.

User command: ${command}
`;

    const result = await callGeminiWithRetry(
      preferredModel,
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
      apiKey
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
