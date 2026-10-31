import { createContext, useEffect, useState } from "react";
import axios from "axios";

export const userDataContext = createContext();

const UserContext = ({ children }) => {
  // Determine server URL: env var > localhost (port 8000) > production vercel URL
  const serverUrl =
    import.meta.env.VITE_BACKEND_URL ||
    (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
      ? "http://localhost:8000"
      : "https://virtual-assistant-eight.vercel.app");

  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [frontendImage, setFrontendImage] = useState(null);
  const [backendImage, setBackendImage] = useState(null);
  const [selectedImage, setSelectImage] = useState(null);

  // Chat conversation messages for Interactive Conversation View
  const [conversation, setConversation] = useState(() => {
    try {
      const saved = sessionStorage.getItem("assistant_conversation");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Language settings
  const [selectedLang, setSelectedLang] = useState(() => {
    return localStorage.getItem("assistant_lang") || "hindi";
  });

  // Voice & Speech synthesis settings
  const [voiceRate, setVoiceRate] = useState(() => {
    return parseFloat(localStorage.getItem("assistant_voice_rate")) || 1.0;
  });

  const [voicePitch, setVoicePitch] = useState(() => {
    return parseFloat(localStorage.getItem("assistant_voice_pitch")) || 1.0;
  });

  const [voiceMuted, setVoiceMuted] = useState(() => {
    return localStorage.getItem("assistant_voice_muted") === "true";
  });

  const [preferredVoiceURI, setPreferredVoiceURI] = useState(() => {
    return localStorage.getItem("assistant_voice_uri") || "";
  });

  const handleLanguageChange = (lang) => {
    setSelectedLang(lang);
    localStorage.setItem("assistant_lang", lang);
  };

  const handleVoiceRateChange = (rate) => {
    setVoiceRate(rate);
    localStorage.setItem("assistant_voice_rate", rate.toString());
  };

  const handleVoicePitchChange = (pitch) => {
    setVoicePitch(pitch);
    localStorage.setItem("assistant_voice_pitch", pitch.toString());
  };

  const handleVoiceMutedToggle = () => {
    setVoiceMuted((prev) => {
      const next = !prev;
      localStorage.setItem("assistant_voice_muted", next.toString());
      return next;
    });
  };

  const handlePreferredVoiceChange = (uri) => {
    setPreferredVoiceURI(uri);
    localStorage.setItem("assistant_voice_uri", uri);
  };

  // Add conversation message helper
  const addConversationEntry = (entry) => {
    setConversation((prev) => {
      const next = [
        ...prev,
        {
          id: Date.now() + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          ...entry,
        },
      ];
      try {
        sessionStorage.setItem(
          "assistant_conversation",
          JSON.stringify(next.slice(-60))
        );
      } catch (_e) {
        // storage quota safety
      }
      return next;
    });
  };

  const clearConversation = () => {
    setConversation([]);
    try {
      sessionStorage.removeItem("assistant_conversation");
    } catch (_e) {}
  };

  const handleCurrentUser = async () => {
    try {
      setLoadingUser(true);
      const result = await axios.get(`${serverUrl}/api/user/current`, {
        withCredentials: true,
      });
      setUserData(result.data);
      if (result.data?.assistantImage) {
        setSelectImage(result.data.assistantImage);
      }
    } catch (error) {
      console.log(
        "Current user error / Not logged in:",
        error?.response?.status || error.message
      );
      setUserData(null);
    } finally {
      setLoadingUser(false);
    }
  };

  const getGeminiResponse = async (command, lang = selectedLang) => {
    try {
      const result = await axios.post(
        `${serverUrl}/api/user/askassistant`,
        { command, lang },
        { withCredentials: true }
      );
      return result.data;
    } catch (error) {
      console.error("Gemini response error:", error);
      throw error;
    }
  };

  const clearHistory = async () => {
    try {
      const result = await axios.delete(`${serverUrl}/api/user/history`, {
        withCredentials: true,
      });
      if (result.data?.user) {
        setUserData(result.data.user);
      } else {
        setUserData((prev) => (prev ? { ...prev, history: [] } : prev));
      }
      return true;
    } catch (error) {
      console.error("Failed to clear history:", error);
      return false;
    }
  };

  // Update User Profile (User's own Name and User Profile Image)
  const updateUserProfile = async ({ name, userImage, imageFile }) => {
    const formData = new FormData();
    if (name) formData.append("name", name);
    if (imageFile) {
      formData.append("image", imageFile);
    } else if (userImage) {
      formData.append("userImage", userImage);
    }

    const result = await axios.post(`${serverUrl}/api/user/profile`, formData, {
      withCredentials: true,
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (result.data?.user) {
      setUserData(result.data.user);
    }
    return result.data;
  };

  // Update Assistant Settings
  const updateAssistantProfile = async ({ assistantName, assistantImage, imageFile }) => {
    const formData = new FormData();
    if (assistantName) formData.append("assistantName", assistantName);
    if (imageFile) {
      formData.append("image", imageFile);
    } else if (assistantImage) {
      formData.append("imageUrl", assistantImage);
    }

    const result = await axios.post(`${serverUrl}/api/user/update`, formData, {
      withCredentials: true,
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (result.data) {
      setUserData(result.data);
    }
    return result.data;
  };

  useEffect(() => {
    handleCurrentUser();
  }, []);

  const value = {
    serverUrl,
    userData,
    setUserData,
    loadingUser,
    handleCurrentUser,
    backendImage,
    setBackendImage,
    frontendImage,
    setFrontendImage,
    selectedImage,
    setSelectImage,
    selectedLang,
    setSelectedLang: handleLanguageChange,
    voiceRate,
    setVoiceRate: handleVoiceRateChange,
    voicePitch,
    setVoicePitch: handleVoicePitchChange,
    voiceMuted,
    toggleVoiceMuted: handleVoiceMutedToggle,
    preferredVoiceURI,
    setPreferredVoiceURI: handlePreferredVoiceChange,
    conversation,
    addConversationEntry,
    clearConversation,
    getGeminiResponse,
    clearHistory,
    updateUserProfile,
    updateAssistantProfile,
  };

  return (
    <userDataContext.Provider value={value}>
      {children}
    </userDataContext.Provider>
  );
};

export default UserContext;
