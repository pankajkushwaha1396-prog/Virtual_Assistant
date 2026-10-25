import geminiResponse from "../gemini.js";
import User from "../models/user.model.js";
import moment from "moment";
import uploadOnCloudinary from "../config/cloudinary.js";

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
      const uploadedUrl = await uploadOnCloudinary(req.file.path);
      if (uploadedUrl) {
        assistantImage = uploadedUrl;
      } else {
        return res.status(500).json({
          message: "Failed to upload image to Cloudinary",
        });
      }
    }

    const updateData = {};
    if (assistantName) updateData.assistantName = assistantName.trim();
    if (assistantImage) updateData.assistantImage = assistantImage;

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Update assistant error:", error);
    return res.status(500).json({
      message: "Update assistant error",
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

    const gemResult = await geminiResponse(
      command,
      assistantName,
      userName,
      lang
    );

    console.log("Gemini Result:", gemResult);

    if (!gemResult || typeof gemResult !== "object") {
      return res.status(502).json({
        response:
          lang === "english"
            ? "Invalid response from AI model"
            : "सहायक से अमान्य उत्तर प्राप्त हुआ।",
      });
    }

    const type = gemResult.type;

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
          userInput: gemResult.userInput,
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
          userInput: gemResult.userInput,
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
          userInput: gemResult.userInput,
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
          userInput: gemResult.userInput,
          response,
        });
      }

      case "google-open":
      case "google-search":
      case "youtube-open":
      case "youtube-search":
      case "youtube-play":
      case "general":
      case "calculator-open":
      case "instagram-open":
      case "facebook-open":
      case "whatsapp-open":
      case "gmail-open":
      case "github-open":
      case "maps-open":
      case "news-open":
      case "wikipedia-open":
      case "weather-show":
        return res.status(200).json({
          type,
          userInput: gemResult.userInput,
          response: gemResult.response,
        });

      default:
        return res.status(200).json({
          type: "general",
          userInput: gemResult.userInput || "",
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
