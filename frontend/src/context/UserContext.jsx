import { createContext, useEffect, useState } from "react";
import axios from "axios";

export const userDataContext = createContext();

const UserContext = ({ children }) => {
  const serverUrl = "https://virtual-assistant-eight.vercel.app";
  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [frontendImage, setFrontendImage] = useState(null);
  const [backendImage, setBackendImage] = useState(null);
  const [selectedImage, setSelectImage] = useState(null);
  const [selectedLang, setSelectedLang] = useState(() => {
    return localStorage.getItem("assistant_lang") || "hindi";
  });

  const handleLanguageChange = (lang) => {
    setSelectedLang(lang);
    localStorage.setItem("assistant_lang", lang);
  };

  const handleCurrentUser = async () => {
    try {
      setLoadingUser(true);
      const result = await axios.get(`${serverUrl}/api/user/current`, {
        withCredentials: true,
      });
      setUserData(result.data);
    } catch (error) {
      console.log("Current user error / Not logged in:", error?.response?.status || error.message);
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
    getGeminiResponse,
    clearHistory,
  };

  return (
    <userDataContext.Provider value={value}>
      {children}
    </userDataContext.Provider>
  );
};

export default UserContext;
