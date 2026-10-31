import geminiResponse from "../gemini.js";
import User from "../models/user.model.js";
import moment from "moment";
import uploadOnCloudinary from "../config/cloudinary.js";

// Helper to determine image URL from file upload (Cloudinary with local static fallback)
const resolveUploadedImageUrl = async (req) => {
  if (!req.file) return null;

  // 1. Try Cloudinary
  try {
    const uploadedUrl = await uploadOnCloudinary(req.file.path);
    if (uploadedUrl) return uploadedUrl;
  } catch (err) {
    console.warn("Cloudinary error, falling back to local storage:", err.message);
  }

  // 2. Fallback to locally served file
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.get("host") || "localhost:8000";
  const normalizedPath = req.file.path.replace(/\\/g, "/");
  const publicRelative = normalizedPath.startsWith("public/")
    ? normalizedPath.substring("public/".length)
    : normalizedPath.replace(/^.*\/public\//, "");

  return `${protocol}://${host}/public/${publicRelative}`;
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({
      message: "Get current user error",
    });
  }
};

export const updateAssistant = async (req, res) => {
  try {
    const { assistantName, imageUrl } = req.body;
    let assistantImage = imageUrl;

    if (req.file) {
      const fileUrl = await resolveUploadedImageUrl(req);
      if (fileUrl) {
        assistantImage = fileUrl;
      }
    }

    const updateData = {};
    if (typeof assistantName === "string" && assistantName.trim()) {
      updateData.assistantName = assistantName.trim();
    }
    if (typeof assistantImage === "string" && assistantImage.trim()) {
      updateData.assistantImage = assistantImage.trim();
    }

    const user = await User.findByIdAndUpdate(req.userId, updateData, {
      new: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Update assistant error:", error);
    return res.status(500).json({
      message: "Update assistant error: " + (error.message || "Unknown error"),
    });
  }
};

// Update User Profile (User's own Name & Profile Picture)
export const updateUserProfile = async (req, res) => {
  try {
    const { name, userImage: bodyUserImage } = req.body;
    let userImage = bodyUserImage;

    if (req.file) {
      const fileUrl = await resolveUploadedImageUrl(req);
      if (fileUrl) {
        userImage = fileUrl;
      }
    }

    const updateData = {};
    if (typeof name === "string" && name.trim()) {
      updateData.name = name.trim();
    }
    if (typeof userImage === "string" && userImage.trim()) {
      updateData.userImage = userImage.trim();
    }

    const user = await User.findByIdAndUpdate(req.userId, updateData, {
      new: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      message: "Update profile error: " + (error.message || "Unknown error"),
    });
  }
};

export const askToAssistant = async (req, res) => {
  try {
    const { command, lang = "hindi" } = req.body;

    if (typeof command !== "string" || !command.trim()) {
      return res.status(400).json({
        response:
          lang === "english"
            ? "Please provide a command."
            : "कृपया कोई निर्देश दें।",
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        response: "User not found",
      });
    }

    // Save command to history (limit to latest 50 entries)
    if (!Array.isArray(user.history)) {
      user.history = [];
    }
    user.history.unshift(command.trim());
    if (user.history.length > 50) {
      user.history = user.history.slice(0, 50);
    }
    await user.save();

    const userName = user.name || "User";
    const assistantName = user.assistantName || "Assistant";

    console.log("User command:", command, "| Language:", lang);

    let gemResult;
    try {
      gemResult = await geminiResponse(
        command,
        assistantName,
        userName,
        lang
      );
    } catch (apiErr) {
      console.warn("Gemini service call failed, generating smart fallback response:", apiErr.message);

      // Smart offline / fallback rule-based response
      const lower = command.toLowerCase();

      // Flipkart detection
      if (lower.includes("flipkart") || lower.includes("फ्लिपकार्ट")) {
        const query = command.replace(/flipkart|फ्लिपकार्ट|पर|दिखाओ|search|खोजो|खोलो|open/gi, "").trim();
        if (query) {
          gemResult = {
            type: "flipkart-search",
            userInput: query,
            siteName: "Flipkart",
            targetUrl: `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
            response: lang === "english" ? `Searching ${query} on Flipkart.` : `फ्लिपकार्ट पर ${query} खोज रहे हैं।`,
          };
        } else {
          gemResult = {
            type: "flipkart-open",
            userInput: "",
            siteName: "Flipkart",
            targetUrl: "https://www.flipkart.com/",
            response: lang === "english" ? "Opening Flipkart for you." : "फ्लिपकार्ट खोल रहे हैं।",
          };
        }
      }
      // Amazon detection
      else if (lower.includes("amazon") || lower.includes("अमेज़न")) {
        const query = command.replace(/amazon|अमेज़न|पर|दिखाओ|search|खोजो|खोलो|open/gi, "").trim();
        if (query) {
          gemResult = {
            type: "amazon-search",
            userInput: query,
            siteName: "Amazon",
            targetUrl: `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
            response: lang === "english" ? `Searching ${query} on Amazon.` : `अमेज़न पर ${query} खोज रहे हैं।`,
          };
        } else {
          gemResult = {
            type: "amazon-open",
            userInput: "",
            siteName: "Amazon",
            targetUrl: "https://www.amazon.in/",
            response: lang === "english" ? "Opening Amazon." : "अमेज़न खोल रहे हैं।",
          };
        }
      }
      // Meesho
      else if (lower.includes("meesho") || lower.includes("मीशो")) {
        gemResult = {
          type: "meesho-open",
          userInput: "",
          siteName: "Meesho",
          targetUrl: "https://www.meesho.com/",
          response: lang === "english" ? "Opening Meesho." : "मीशो खोल रहे हैं।",
        };
      }
      // Myntra
      else if (lower.includes("myntra") || lower.includes("मिंत्रा")) {
        gemResult = {
          type: "myntra-open",
          userInput: "",
          siteName: "Myntra",
          targetUrl: "https://www.myntra.com/",
          response: lang === "english" ? "Opening Myntra." : "मिंत्रा खोल रहे हैं।",
        };
      }
      // Swiggy
      else if (lower.includes("swiggy") || lower.includes("स्वीगी")) {
        gemResult = {
          type: "swiggy-open",
          userInput: "",
          siteName: "Swiggy",
          targetUrl: "https://www.swiggy.com/",
          response: lang === "english" ? "Opening Swiggy." : "स्वीगी खोल रहे हैं।",
        };
      }
      // Zomato
      else if (lower.includes("zomato") || lower.includes("ज़ोमैटो")) {
        gemResult = {
          type: "zomato-open",
          userInput: "",
          siteName: "Zomato",
          targetUrl: "https://www.zomato.com/",
          response: lang === "english" ? "Opening Zomato." : "ज़ोमैटो खोल रहे हैं।",
        };
      }
      // Netflix
      else if (lower.includes("netflix") || lower.includes("नेटफ्लिक्स")) {
        gemResult = {
          type: "netflix-open",
          userInput: "",
          siteName: "Netflix",
          targetUrl: "https://www.netflix.com/",
          response: lang === "english" ? "Opening Netflix." : "नेटफ्लिक्स खोल रहे हैं।",
        };
      }
      // Spotify
      else if (lower.includes("spotify") || lower.includes("स्पॉटिफ़ाई")) {
        gemResult = {
          type: "spotify-open",
          userInput: "",
          siteName: "Spotify",
          targetUrl: "https://open.spotify.com/",
          response: lang === "english" ? "Opening Spotify." : "स्पॉटिफ़ाई खोल रहे हैं।",
        };
      }
      // ChatGPT
      else if (lower.includes("chatgpt")) {
        gemResult = {
          type: "chatgpt-open",
          userInput: "",
          siteName: "ChatGPT",
          targetUrl: "https://chatgpt.com/",
          response: lang === "english" ? "Opening ChatGPT." : "चैटजीपीटी खोल रहे हैं।",
        };
      }
      // Twitter / X
      else if (lower.includes("twitter") || lower.includes("ट्विटर") || lower.includes("x.com")) {
        gemResult = {
          type: "twitter-open",
          userInput: "",
          siteName: "X (Twitter)",
          targetUrl: "https://x.com/",
          response: lang === "english" ? "Opening Twitter." : "ट्विटर खोल रहे हैं।",
        };
      }
      // Cricbuzz
      else if (lower.includes("cricbuzz") || lower.includes("क्रिकबज़") || lower.includes("cricket score")) {
        gemResult = {
          type: "cricbuzz-open",
          userInput: "",
          siteName: "Cricbuzz",
          targetUrl: "https://www.cricbuzz.com/",
          response: lang === "english" ? "Opening Cricbuzz." : "क्रिकबज़ खोल रहे हैं।",
        };
      }
      // Time inquiry
      else if (lower.includes("time") || lower.includes("समय")) {
        gemResult = { type: "get-time", userInput: "", response: "" };
      }
      // Date inquiry
      else if (lower.includes("date") || lower.includes("तारीख")) {
        gemResult = { type: "get-date", userInput: "", response: "" };
      }
      // Day inquiry
      else if (lower.includes("day") || lower.includes("दिन")) {
        gemResult = { type: "get-day", userInput: "", response: "" };
      }
      // Google search
      else if (lower.includes("google") || lower.includes("गूगल")) {
        gemResult = {
          type: "google-search",
          userInput: command.replace(/google|search|खोजो|गूगल/gi, "").trim(),
          response: lang === "english" ? "Searching Google for you." : "गूगल पर खोज रहे हैं।",
        };
      }
      // YouTube
      else if (lower.includes("youtube") || lower.includes("यूट्यूब")) {
        gemResult = {
          type: "youtube-search",
          userInput: command.replace(/youtube|play|song|यूट्यूब|गाने|चलाओ/gi, "").trim(),
          response: lang === "english" ? "Opening YouTube." : "यूट्यूब खोल रहे हैं।",
        };
      }
      // General Fallback
      else {
        gemResult = {
          type: "general",
          userInput: "",
          response:
            lang === "english"
              ? `I heard: "${command}". I am here to help you!`
              : `मैंने सुना: "${command}"। मैं आपकी सहायता के लिए तैयार हूँ!`,
        };
      }
    }

    console.log("Gemini Result:", gemResult);

    if (!gemResult || typeof gemResult !== "object") {
      return res.status(502).json({
        response:
          lang === "english"
            ? "Invalid response from AI model"
            : "सहायक से अमान्य उत्तर प्राप्त हुआ।",
      });
    }

    const type = gemResult.type || "general";

    // Handle time & date formatting specifically on server
    switch (type) {
      case "get-date": {
        const hindiMonths = [
          "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
          "जुलाई", "अगस्त", "सितम्बर", "अक्टूबर", "नवम्बर", "दिसम्बर",
        ];
        const dateObj = new Date();
        const hindiDate = `${dateObj.getDate()} ${hindiMonths[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        const response =
          lang === "english"
            ? `Current date is ${moment().format("MMMM Do, YYYY")}`
            : `आज की तारीख ${hindiDate} है।`;

        return res.json({
          type,
          userInput: gemResult.userInput || "",
          response,
        });
      }

      case "get-time": {
        const timeStr = moment().format("hh:mm A");
        const response =
          lang === "english"
            ? `Current time is ${timeStr}`
            : `अभी का समय ${timeStr} है।`;

        return res.json({
          type,
          userInput: gemResult.userInput || "",
          response,
        });
      }

      case "get-day": {
        const hindiDays = [
          "रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार",
        ];
        const dayName = hindiDays[new Date().getDay()];
        const response =
          lang === "english"
            ? `Today is ${moment().format("dddd")}`
            : `आज ${dayName} है।`;

        return res.json({
          type,
          userInput: gemResult.userInput || "",
          response,
        });
      }

      case "get-month": {
        const hindiMonths = [
          "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
          "जुलाई", "अगस्त", "सितम्बर", "अक्टूबर", "नवम्बर", "दिसम्बर",
        ];
        const monthName = hindiMonths[new Date().getMonth()];
        const response =
          lang === "english"
            ? `Current month is ${moment().format("MMMM")}`
            : `अभी ${monthName} का महीना चल रहा है।`;

        return res.json({
          type,
          userInput: gemResult.userInput || "",
          response,
        });
      }

      // Return all website, search, command, and general responses directly with targetUrl & siteName
      default:
        return res.status(200).json({
          type,
          userInput: gemResult.userInput || "",
          targetUrl: gemResult.targetUrl || "",
          siteName: gemResult.siteName || "",
          response:
            gemResult.response ||
            (lang === "english"
              ? "I am not sure how to handle that command yet."
              : "मुझे यह निर्देश ठीक से समझ नहीं आया।"),
        });
    }
  } catch (error) {
    console.error("Ask assistant error:", error);

    return res.status(500).json({
      response: "Ask assistant error: " + (error.message || "Unknown error"),
    });
  }
};

export const clearUserHistory = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { history: [] } },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "History cleared successfully",
      user,
    });
  } catch (error) {
    console.error("Clear history error:", error);
    return res.status(500).json({ message: "Failed to clear history" });
  }
};
