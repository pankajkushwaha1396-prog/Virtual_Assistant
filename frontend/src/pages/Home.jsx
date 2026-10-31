import { useContext, useEffect, useRef, useState } from "react";
import { userDataContext } from "../context/UserContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  IoMdMenu,
  IoMdMic,
  IoMdMicOff,
  IoMdSend,
  IoMdVolumeOff,
  IoMdVolumeHigh,
  IoMdTrash,
  IoMdCopy,
  IoMdCheckmark,
  IoMdRefresh,
  IoMdSettings,
} from "react-icons/io";
import { ImCross } from "react-icons/im";
import {
  FaHistory,
  FaExternalLinkAlt,
  FaComments,
  FaUserCircle,
  FaStopwatch,
  FaStickyNote,
} from "react-icons/fa";
import { MdOutlineEdit, MdPhotoCamera } from "react-icons/md";
import { resolveAvatar, resolveUserAvatar } from "../utils/avatarUtils";

const Home = () => {
  const {
    userData,
    setUserData,
    serverUrl,
    getGeminiResponse,
    selectedLang,
    setSelectedLang,
    clearHistory,
    voiceRate,
    setVoiceRate,
    voicePitch,
    setVoicePitch,
    voiceMuted,
    toggleVoiceMuted,
    conversation,
    addConversationEntry,
    clearConversation,
    updateUserProfile,
  } = useContext(userDataContext);

  const navigate = useNavigate();

  // Assistant states
  const [listening, setListening] = useState(false);
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [actionLink, setActionLink] = useState(null);
  const [copied, setCopied] = useState(false);

  // User Profile edit states
  const [editUserName, setEditUserName] = useState(userData?.name || "");
  const [userProfileFile, setUserProfileFile] = useState(null);
  const [userProfilePreview, setUserProfilePreview] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState("");
  const userFileInputRef = useRef(null);

  // Timers & Notes quick states
  const [activeTimerSeconds, setActiveTimerSeconds] = useState(null);
  const timerIntervalRef = useRef(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesList, setNotesList] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("assistant_quick_notes")) || [];
    } catch {
      return [];
    }
  });
  const [newNoteText, setNewNoteText] = useState("");

  // Refs for Speech synthesis & recognition
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const isRecognizingRef = useRef(false);
  const processingRef = useRef(false);
  const activeMicRef = useRef(false);
  const restartTimerRef = useRef(null);
  const speechTimeoutRef = useRef(null);
  const utteranceRef = useRef(null);

  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

  // Language configuration
  const isHindi = selectedLang === "hindi";
  const speechLangCode = isHindi ? "hi-IN" : "en-US";

  // Resolved safe avatars
  const assistantAvatarSrc = resolveAvatar(userData?.assistantImage);
  const userAvatarSrc = userProfilePreview || resolveUserAvatar(userData?.userImage);

  // Derived timer formatted string
  const timerDisplay =
    activeTimerSeconds !== null
      ? `${Math.floor(activeTimerSeconds / 60)}:${
          activeTimerSeconds % 60 < 10 ? "0" : ""
        }${activeTimerSeconds % 60}`
      : "";

  // Preferred Voice selector
  const getPreferredVoice = (targetLang) => {
    if (!synth) return null;
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;

    if (targetLang === "hi-IN") {
      const hindiVoice = voices.find(
        (v) =>
          v.lang.toLowerCase() === "hi-in" ||
          v.lang.toLowerCase().startsWith("hi") ||
          v.name.toLowerCase().includes("hindi")
      );
      if (hindiVoice) return hindiVoice;

      const indianVoice = voices.find(
        (v) =>
          v.lang.toLowerCase() === "en-in" ||
          v.name.toLowerCase().includes("india")
      );
      if (indianVoice) return indianVoice;
    }

    return (
      voices.find((v) => v.lang.toLowerCase() === "en-us") ||
      voices.find((v) => v.default) ||
      voices[0]
    );
  };

  // Safe restart of speech recognition with configurable debounce
  const scheduleRestart = (delay = 800) => {
    clearTimeout(restartTimerRef.current);
    if (!activeMicRef.current || isSpeakingRef.current || processingRef.current) {
      return;
    }
    restartTimerRef.current = setTimeout(() => {
      startRecognition();
    }, delay);
  };

  const startRecognition = () => {
    if (
      !activeMicRef.current ||
      isSpeakingRef.current ||
      isRecognizingRef.current ||
      processingRef.current ||
      !recognitionRef.current
    ) {
      return;
    }

    try {
      recognitionRef.current.lang = speechLangCode;
      recognitionRef.current.start();
    } catch (error) {
      if (error.name !== "InvalidStateError") {
        console.warn("Recognition start notice:", error.message);
      }
    }
  };

  const stopRecognition = () => {
    activeMicRef.current = false;
    clearTimeout(restartTimerRef.current);
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    isRecognizingRef.current = false;
    setListening(false);
    setStatus("Ready");
  };

  const toggleMic = () => {
    if (activeMicRef.current) {
      stopRecognition();
    } else {
      activeMicRef.current = true;
      setStatus(isHindi ? "माइक चालू हो रहा है..." : "Starting microphone...");
      startRecognition();
    }
  };

  const finishSpeaking = () => {
    clearTimeout(speechTimeoutRef.current);
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    processingRef.current = false;
    setIsProcessing(false);
    utteranceRef.current = null;

    if (activeMicRef.current) {
      setStatus(isHindi ? "🎤 सुन रहा हूँ..." : "🎤 Listening...");
      scheduleRestart(600);
    } else {
      setStatus("Ready");
    }
  };

  const stopSpeaking = () => {
    clearTimeout(speechTimeoutRef.current);
    if (synth) {
      try {
        synth.cancel();
      } catch {
        // ignore
      }
    }
    finishSpeaking();
  };

  // Speak text with SpeechSynthesis
  const speak = (text) => {
    if (!synth || voiceMuted || !text || !text.trim()) {
      finishSpeaking();
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }
    isRecognizingRef.current = false;
    setListening(false);

    try {
      synth.cancel();
      if (synth.paused) {
        synth.resume();
      }
    } catch {
      // ignore
    }

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utteranceRef.current = utterance;

    const preferredVoice = getPreferredVoice(speechLangCode);
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = speechLangCode;
    }

    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;

    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setStatus(isHindi ? "🔊 सहायक बोल रहा है..." : "🔊 Assistant is speaking...");

    clearTimeout(speechTimeoutRef.current);
    const estimatedDurationMs = Math.max(4000, (text.length / 8) * 1000 + 3500);
    speechTimeoutRef.current = setTimeout(() => {
      finishSpeaking();
    }, estimatedDurationMs);

    utterance.onend = () => {
      finishSpeaking();
    };

    utterance.onerror = (event) => {
      console.warn("Speech synthesis notice:", event.error);
      finishSpeaking();
    };

    setTimeout(() => {
      try {
        synth.speak(utterance);
      } catch (err) {
        console.error("synth.speak error:", err);
        finishSpeaking();
      }
    }, 150);
  };

  // Copy AI response
  const handleCopyText = (textToCopy) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Quick Timer handling
  const startTimer = (seconds, label = "Timer") => {
    clearInterval(timerIntervalRef.current);
    setActiveTimerSeconds(seconds);

    timerIntervalRef.current = setInterval(() => {
      setActiveTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          const alertMsg = isHindi ? `⏰ ${label} समाप्त हो गया!` : `⏰ ${label} is finished!`;
          speak(alertMsg);
          alert(alertMsg);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelTimer = () => {
    clearInterval(timerIntervalRef.current);
    setActiveTimerSeconds(null);
  };

  // Notes management
  const handleAddNote = (noteContent) => {
    if (!noteContent || !noteContent.trim()) return;
    const note = {
      id: Date.now(),
      text: noteContent.trim(),
      date: new Date().toLocaleDateString(),
    };
    const updated = [note, ...notesList];
    setNotesList(updated);
    localStorage.setItem("assistant_quick_notes", JSON.stringify(updated));
    setNewNoteText("");
  };

  const handleDeleteNote = (id) => {
    const updated = notesList.filter((n) => n.id !== id);
    setNotesList(updated);
    localStorage.setItem("assistant_quick_notes", JSON.stringify(updated));
  };

  // Helper to open website directly and handle popup blockers
  const openUrlDirectly = (targetUrl, siteTitle) => {
    if (!targetUrl) return;

    let win = null;
    try {
      win = window.open(targetUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.warn("window.open exception:", err);
    }

    const isBlocked = !win || win.closed || typeof win.closed === "undefined";
    setActionLink({
      url: targetUrl,
      title: siteTitle,
      isBlocked,
    });
  };

  // Helper to clean search query by removing service names and command filler words
  const cleanSearchQuery = (rawInput, commandStr = "") => {
    let text = (rawInput || "").trim();
    if (!text && commandStr) {
      text = commandStr.trim();
    }
    return text
      .replace(/\b(youtube|flipkart|amazon|google|spotify|netflix|meesho|myntra|cricbuzz)\b/gi, "")
      .replace(/\b(open karo|open|karo|खोलो|ओपन करो|ओपन|करो|chalao|चलाओ|play|bajao|बजाओ|search|karke|खोजो|dikhhao|दिखाओ|dikhaye|दिखाइए|par|pe|पर|song|video|gane|गाने|geet|गीत|music|and|aur|और|in|on|for)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Dispatch actions based on intent
  const handleCommandResult = (data, originalCommand = "") => {
    if (!data || typeof data !== "object") {
      finishSpeaking();
      return;
    }

    const {
      type = "general",
      userInput = "",
      response = "",
      targetUrl: serverTargetUrl,
      siteName: serverSiteName,
    } = data;

    const rawInput = (userInput || "").trim();
    const cleanQuery = cleanSearchQuery(rawInput, originalCommand);
    const query = encodeURIComponent(cleanQuery || rawInput);
    const lowerCmd = (originalCommand || "").toLowerCase();

    let url = serverTargetUrl || null;
    let linkTitle = serverSiteName || "";

    // Keyword fallback if type is general or missed:
    let resolvedType = type;
    if (resolvedType === "general" || !url) {
      if (lowerCmd.includes("flipkart") || lowerCmd.includes("फ्लिपकार्ट")) {
        resolvedType = cleanQuery ? "flipkart-search" : "flipkart-open";
      } else if (lowerCmd.includes("amazon") || lowerCmd.includes("अमेज़न")) {
        resolvedType = cleanQuery ? "amazon-search" : "amazon-open";
      } else if (lowerCmd.includes("meesho") || lowerCmd.includes("मीशो")) {
        resolvedType = "meesho-open";
      } else if (lowerCmd.includes("myntra") || lowerCmd.includes("मिंत्रा")) {
        resolvedType = "myntra-open";
      } else if (lowerCmd.includes("swiggy") || lowerCmd.includes("स्वीगी")) {
        resolvedType = "swiggy-open";
      } else if (lowerCmd.includes("zomato") || lowerCmd.includes("ज़ोमैटो")) {
        resolvedType = "zomato-open";
      } else if (lowerCmd.includes("blinkit")) {
        resolvedType = "blinkit-open";
      } else if (lowerCmd.includes("netflix") || lowerCmd.includes("नेटफ्लिक्स")) {
        resolvedType = cleanQuery ? "netflix-search" : "netflix-open";
      } else if (lowerCmd.includes("spotify") || lowerCmd.includes("स्पॉटिफ़ाई")) {
        resolvedType = cleanQuery ? "spotify-search" : "spotify-open";
      } else if (lowerCmd.includes("chatgpt")) {
        resolvedType = "chatgpt-open";
      } else if (lowerCmd.includes("cricbuzz") || lowerCmd.includes("क्रिकबज़")) {
        resolvedType = "cricbuzz-open";
      } else if (lowerCmd.includes("twitter") || lowerCmd.includes("ट्विटर") || lowerCmd.includes("x.com")) {
        resolvedType = "twitter-open";
      } else if (lowerCmd.includes("linkedin") || lowerCmd.includes("लिंक्डइन")) {
        resolvedType = "linkedin-open";
      } else if (lowerCmd.includes("reddit") || lowerCmd.includes("रेडिट")) {
        resolvedType = "reddit-open";
      } else if (lowerCmd.includes("hotstar") || lowerCmd.includes("हॉटस्टार") || lowerCmd.includes("jiocinema")) {
        resolvedType = "hotstar-open";
      } else if (lowerCmd.includes("youtube") || lowerCmd.includes("यूट्यूब")) {
        resolvedType = cleanQuery ? "youtube-search" : "youtube-open";
      }
    }

    switch (resolvedType) {
      // Flipkart
      case "flipkart-open":
        url = "https://www.flipkart.com/";
        linkTitle = isHindi ? "फ्लिपकार्ट" : "Flipkart";
        break;

      case "flipkart-search":
        url = cleanQuery
          ? `https://www.flipkart.com/search?q=${query}`
          : "https://www.flipkart.com/";
        linkTitle = cleanQuery ? `Flipkart: ${cleanQuery}` : "Flipkart";
        break;

      // Amazon
      case "amazon-open":
        url = "https://www.amazon.in/";
        linkTitle = isHindi ? "अमेज़न" : "Amazon";
        break;

      case "amazon-search":
        url = cleanQuery
          ? `https://www.amazon.in/s?k=${query}`
          : "https://www.amazon.in/";
        linkTitle = cleanQuery ? `Amazon: ${cleanQuery}` : "Amazon";
        break;

      // Meesho
      case "meesho-open":
      case "meesho-search":
        url = cleanQuery
          ? `https://www.meesho.com/search?q=${query}`
          : "https://www.meesho.com/";
        linkTitle = cleanQuery ? `Meesho: ${cleanQuery}` : "Meesho";
        break;

      // Myntra
      case "myntra-open":
      case "myntra-search":
        url = cleanQuery
          ? `https://www.myntra.com/${query}`
          : "https://www.myntra.com/";
        linkTitle = cleanQuery ? `Myntra: ${cleanQuery}` : "Myntra";
        break;

      // Swiggy
      case "swiggy-open":
        url = cleanQuery
          ? `https://www.swiggy.com/search?query=${query}`
          : "https://www.swiggy.com/";
        linkTitle = "Swiggy";
        break;

      // Zomato
      case "zomato-open":
        url = "https://www.zomato.com/";
        linkTitle = "Zomato";
        break;

      // Blinkit
      case "blinkit-open":
        url = cleanQuery
          ? `https://www.blinkit.com/s/?q=${query}`
          : "https://www.blinkit.com/";
        linkTitle = "Blinkit";
        break;

      // Netflix
      case "netflix-open":
      case "netflix-search":
        url = cleanQuery
          ? `https://www.netflix.com/search?q=${query}`
          : "https://www.netflix.com/";
        linkTitle = cleanQuery ? `Netflix: ${cleanQuery}` : "Netflix";
        break;

      // Spotify
      case "spotify-open":
      case "spotify-search":
        url = cleanQuery
          ? `https://open.spotify.com/search/${query}`
          : "https://open.spotify.com/";
        linkTitle = cleanQuery ? `Spotify: ${cleanQuery}` : "Spotify";
        break;

      // Hotstar / JioCinema
      case "hotstar-open":
        url = "https://www.hotstar.com/in";
        linkTitle = "Hotstar";
        break;

      // ChatGPT
      case "chatgpt-open":
        url = "https://chatgpt.com/";
        linkTitle = "ChatGPT";
        break;

      // Twitter / X
      case "twitter-open":
      case "x-open":
        url = cleanQuery ? `https://x.com/search?q=${query}` : "https://x.com/";
        linkTitle = "X (Twitter)";
        break;

      // LinkedIn
      case "linkedin-open":
        url = "https://www.linkedin.com/";
        linkTitle = "LinkedIn";
        break;

      // Cricbuzz
      case "cricbuzz-open":
        url = "https://www.cricbuzz.com/";
        linkTitle = "Cricbuzz Cricket";
        break;

      // Reddit
      case "reddit-open":
        url = cleanQuery
          ? `https://www.reddit.com/search/?q=${query}`
          : "https://www.reddit.com/";
        linkTitle = "Reddit";
        break;

      // Pinterest
      case "pinterest-open":
        url = cleanQuery
          ? `https://www.pinterest.com/search/pins/?q=${query}`
          : "https://www.pinterest.com/";
        linkTitle = "Pinterest";
        break;

      // Google
      case "google-open":
        url = "https://www.google.com/";
        linkTitle = isHindi ? "गूगल" : "Google";
        break;

      case "google-search":
        url = cleanQuery
          ? `https://www.google.com/search?q=${query}`
          : "https://www.google.com/";
        linkTitle = cleanQuery
          ? `${cleanQuery} - Google Search`
          : "Google Search";
        break;

      // YouTube
      case "youtube-open":
        url = "https://www.youtube.com/";
        linkTitle = isHindi ? "यूट्यूब" : "YouTube";
        break;

      case "youtube-search":
      case "youtube-play":
        url = cleanQuery
          ? `https://www.youtube.com/results?search_query=${query}`
          : "https://www.youtube.com/";
        linkTitle = cleanQuery ? `YouTube: ${cleanQuery}` : "YouTube";
        break;

      case "calculator-open":
        url = "https://www.google.com/search?q=calculator";
        linkTitle = isHindi ? "कैलकुलेटर" : "Calculator";
        break;

      case "instagram-open":
        url = "https://www.instagram.com/";
        linkTitle = "Instagram";
        break;

      case "facebook-open":
        url = "https://www.facebook.com/";
        linkTitle = "Facebook";
        break;

      case "whatsapp-open":
        url = "https://web.whatsapp.com/";
        linkTitle = "WhatsApp Web";
        break;

      case "gmail-open":
        url = "https://mail.google.com/";
        linkTitle = "Gmail";
        break;

      case "github-open":
        url = cleanQuery
          ? `https://github.com/search?q=${query}`
          : "https://github.com/";
        linkTitle = cleanQuery ? `GitHub: ${cleanQuery}` : "GitHub";
        break;

      case "maps-open":
        url = cleanQuery
          ? `https://www.google.com/maps/search/${query}`
          : "https://maps.google.com/";
        linkTitle = cleanQuery ? `Google Maps: ${cleanQuery}` : "Google Maps";
        break;

      case "news-open":
        url = cleanQuery
          ? `https://news.google.com/search?q=${query}`
          : "https://news.google.com/";
        linkTitle = cleanQuery ? `News: ${cleanQuery}` : "Google News";
        break;

      case "wikipedia-open":
        url = cleanQuery
          ? `https://${isHindi ? "hi" : "en"}.wikipedia.org/wiki/${query}`
          : `https://${isHindi ? "hi" : "en"}.wikipedia.org/`;
        linkTitle = cleanQuery ? `Wikipedia: ${cleanQuery}` : "Wikipedia";
        break;

      case "weather-show":
        url = cleanQuery
          ? `https://www.google.com/search?q=weather+${query}`
          : "https://www.google.com/search?q=weather";
        linkTitle = isHindi ? "मौसम" : "Weather Info";
        break;

      case "timer-open":
        startTimer(300, isHindi ? "5 मिनट का टाइमर" : "5 Minute Timer");
        break;

      case "notes-open":
        setNotesOpen(true);
        if (cleanQuery) handleAddNote(cleanQuery);
        break;

      case "translate-open":
        url = cleanQuery
          ? `https://translate.google.com/?sl=auto&tl=${isHindi ? "hi" : "en"}&text=${query}`
          : "https://translate.google.com/";
        linkTitle = "Google Translate";
        break;

      // Universal Website Opener
      case "website-open": {
        const rawUrl = serverTargetUrl || cleanQuery || "";
        if (rawUrl) {
          url = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
            ? rawUrl
            : `https://${rawUrl.replace(/^www\./, "")}`;
        } else {
          url = "https://www.google.com/";
        }
        linkTitle = serverSiteName || cleanQuery || (isHindi ? "वेबसाइट" : "Website");
        break;
      }

      default:
        break;
    }

    if (url) {
      openUrlDirectly(url, linkTitle || "Website");
    } else {
      setActionLink(null);
    }

    setAiText(response);
    speak(response);

    // Save to interactive chat conversation history
    addConversationEntry({
      userText: originalCommand || userText,
      aiText: response,
      actionLink: url ? { url, title: linkTitle } : null,
    });
  };

  // Process any command string
  const executeCommand = async (commandText) => {
    if (!commandText || !commandText.trim()) return;

    if (processingRef.current) {
      console.log("Already processing a command, skipping duplicate trigger.");
      return;
    }

    const trimmed = commandText.trim();
    setUserText(trimmed);
    setAiText("");
    setActionLink(null);
    setIsProcessing(true);
    processingRef.current = true;
    setStatus(isHindi ? "⏳ समझ रहे हैं..." : "⏳ Processing command...");

    // Abort recognition immediately to release microphone stream
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }
    isRecognizingRef.current = false;
    setListening(false);

    try {
      const data = await getGeminiResponse(trimmed, selectedLang);

      if (data && typeof data === "object") {
        setUserData((prev) => {
          if (!prev) return prev;
          const currentHist = prev.history || [];
          return {
            ...prev,
            history: [
              trimmed,
              ...currentHist.filter((h) => h !== trimmed),
            ].slice(0, 50),
          };
        });
        handleCommandResult(data, trimmed);
      } else {
        const errorMsg = isHindi
          ? "माफ़ कीजिए, कोई जवाब नहीं मिला।"
          : "Sorry, I received no response.";
        setAiText(errorMsg);
        speak(errorMsg);
      }
    } catch (error) {
      console.error("Execution error:", error);
      const errMsg = isHindi
        ? "त्रुटि: नेटवर्क या सर्वर से जुड़ने में समस्या हुई।"
        : "Error processing your request.";
      setAiText(errMsg);
      speak(errMsg);
      finishSpeaking();
    }
  };

  // Quick suggestion chips including Flipkart & popular websites
  const quickActions = [
    {
      label: isHindi ? "🛍️ फ्लिपकार्ट खोलो" : "🛍️ Open Flipkart",
      cmd: isHindi ? "फ्लिपकार्ट खोलो" : "Open Flipkart",
    },
    {
      label: isHindi ? "📦 अमेज़न खोलो" : "📦 Open Amazon",
      cmd: isHindi ? "अमेज़न खोलो" : "Open Amazon",
    },
    {
      label: isHindi ? "🎵 गाने चलाओ" : "🎵 Play Music",
      cmd: isHindi
        ? "यूट्यूब पर अरिजीत सिंह के गाने चलाओ"
        : "Play trending songs on YouTube",
    },
    {
      label: isHindi ? "⏰ समय बताओ" : "⏰ Current Time",
      cmd: isHindi ? "अभी समय क्या हुआ है?" : "What time is it now?",
    },
    {
      label: isHindi ? "📅 आज की तारीख" : "📅 Today's Date",
      cmd: isHindi ? "आज कौन सी तारीख है?" : "What is today's date?",
    },
    {
      label: isHindi ? "⛅ मौसम" : "⛅ Weather",
      cmd: isHindi ? "आज का मौसम कैसा है?" : "Show today's weather",
    },
    {
      label: isHindi ? "⏱️ 5 मिनट टाइमर" : "⏱️ 5m Timer",
      cmd: isHindi ? "5 मिनट का टाइमर लगाओ" : "Set a 5 minute timer",
    },
    {
      label: isHindi ? "📝 नोट्स" : "📝 Notes",
      cmd: isHindi ? "नोट्स खोलो" : "Open notes",
    },
    {
      label: isHindi ? "🎥 यूट्यूब खोलो" : "🎥 Open YouTube",
      cmd: isHindi ? "यूट्यूब खोलो" : "Open YouTube",
    },
    {
      label: isHindi ? "💬 व्हाट्सएप" : "💬 WhatsApp",
      cmd: isHindi ? "व्हाट्सएप खोलो" : "Open WhatsApp",
    },
    {
      label: isHindi ? "🏏 क्रिकबज़" : "🏏 Cricbuzz",
      cmd: isHindi ? "क्रिकबज़ खोलो" : "Open Cricbuzz",
    },
    {
      label: isHindi ? "🗺️ गूगल मैप्स" : "🗺️ Maps",
      cmd: isHindi ? "गूगल मैप्स खोलो" : "Open Google Maps",
    },
  ];

  // Setup Web SpeechRecognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = speechLangCode;

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      isRecognizingRef.current = true;
      setListening(true);
      setStatus(isHindi ? "🎤 सुन रहा हूँ..." : "🎤 Listening...");
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;
      setListening(false);

      if (
        activeMicRef.current &&
        !isSpeakingRef.current &&
        !processingRef.current
      ) {
        scheduleRestart(800);
      }
    };

    // Cleaned up error handler - silences intentional 'aborted' & handles 'network' gracefully
    recognition.onerror = (event) => {
      // 1. Ignore expected / intentional abort or silence
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }

      // 2. Handle transient network hiccups from Google speech service
      if (event.error === "network") {
        isRecognizingRef.current = false;
        if (
          activeMicRef.current &&
          !isSpeakingRef.current &&
          !processingRef.current
        ) {
          scheduleRestart(1200);
        }
        return;
      }

      // 3. User permission denial
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        activeMicRef.current = false;
        clearTimeout(restartTimerRef.current);
        setListening(false);
        setStatus(
          isHindi
            ? "माइक्रोफ़ोन अनुमति नहीं मिली"
            : "Microphone permission denied"
        );
        return;
      }

      console.warn("Speech recognition notice:", event.error);
    };

    recognition.onresult = (event) => {
      const results = event.results;
      if (!results || results.length === 0) return;

      const transcript = results[results.length - 1][0].transcript.trim();
      if (!transcript || processingRef.current) return;

      console.log("Speech recognized:", transcript);
      executeCommand(transcript);
    };

    return () => {
      activeMicRef.current = false;
      clearTimeout(restartTimerRef.current);
      clearTimeout(speechTimeoutRef.current);
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      if (synth) synth.cancel();
      recognitionRef.current = null;
      isRecognizingRef.current = false;
    };
  }, [selectedLang]);

  const handleLogOut = async () => {
    try {
      activeMicRef.current = false;
      clearTimeout(restartTimerRef.current);
      clearTimeout(speechTimeoutRef.current);
      recognitionRef.current?.stop();
      if (synth) synth.cancel();

      await axios.get(`${serverUrl}/api/auth/logout`, {
        withCredentials: true,
      });

      setUserData(null);
      navigate("/signin");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleClearHistory = async () => {
    if (
      window.confirm(
        isHindi
          ? "क्या आप वाकई पूरी हिस्ट्री साफ़ करना चाहते हैं?"
          : "Are you sure you want to clear your command history?"
      )
    ) {
      await clearHistory();
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    executeCommand(inputText);
    setInputText("");
  };

  // Handle user profile picture selection
  const handleUserProfileImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUserProfileFile(file);
    setUserProfilePreview(URL.createObjectURL(file));
  };

  // Save updated user profile info
  const handleSaveUserProfile = async () => {
    setSavingProfile(true);
    setProfileSuccessMsg("");
    try {
      await updateUserProfile({
        name: editUserName,
        imageFile: userProfileFile,
      });
      setProfileSuccessMsg("Profile updated successfully! ✓");
      setTimeout(() => {
        setProfileSuccessMsg("");
        setProfileModalOpen(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to update profile:", err);
      alert("Failed to update profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-t from-black via-[#04043b] to-[#01011e] flex flex-col justify-between items-center relative overflow-hidden select-none">
      {/* Top Navbar */}
      <header className="w-full max-w-6xl flex justify-between items-center p-4 md:px-8 z-20">
        {/* Assistant Info */}
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full overflow-hidden border-2 border-blue-400 shadow-lg cursor-pointer hover:scale-105 transition-transform"
            onClick={() => navigate("/customize")}
            title="Click to change Assistant Avatar"
          >
            <img
              src={assistantAvatarSrc}
              alt="Avatar"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/default-avatar.svg";
              }}
            />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight flex items-center gap-2">
              {userData?.assistantName || "AI Assistant"}
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </h1>
            <p className="text-xs text-blue-300">
              {isHindi ? "हिंदी में सक्रिय" : "English Mode Active"}
            </p>
          </div>
        </div>

        {/* Center / Right Controls */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Active Timer Pill if Running */}
          {activeTimerSeconds !== null && (
            <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/50 px-3 py-1 rounded-full text-amber-300 text-xs font-semibold animate-pulse">
              <FaStopwatch />
              <span>{timerDisplay}</span>
              <button
                onClick={cancelTimer}
                className="text-amber-300 hover:text-white ml-1 font-bold cursor-pointer"
                title="Cancel Timer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Voice Mute Toggle */}
          <button
            onClick={toggleVoiceMuted}
            title={voiceMuted ? "Unmute Voice" : "Mute Voice"}
            className={`p-2 rounded-full border transition-all cursor-pointer ${
              voiceMuted
                ? "bg-red-600/30 border-red-500 text-red-300"
                : "bg-white/10 hover:bg-white/20 border-white/20 text-white"
            }`}
          >
            {voiceMuted ? (
              <IoMdVolumeOff className="w-5 h-5" />
            ) : (
              <IoMdVolumeHigh className="w-5 h-5" />
            )}
          </button>

          {/* Language Switcher */}
          <div className="flex bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20">
            <button
              onClick={() => setSelectedLang("hindi")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                isHindi
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              🇮🇳 हिंदी
            </button>
            <button
              onClick={() => setSelectedLang("english")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                !isHindi
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              🌐 English
            </button>
          </div>

          {/* Conversation Chat Drawer Toggle */}
          <button
            onClick={() => setChatDrawerOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-full border border-white/20 transition-all cursor-pointer"
            title="Open Conversation Chat View"
          >
            <FaComments className="w-3.5 h-3.5" />
            <span>Chat ({conversation.length})</span>
          </button>

          {/* History Button */}
          <button
            onClick={() => setHistoryOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-full border border-white/20 transition-all cursor-pointer"
          >
            <FaHistory className="w-3.5 h-3.5" />
            <span>{isHindi ? "इतिहास" : "History"}</span>
          </button>

          {/* User Profile Pill */}
          <div
            onClick={() => {
              setEditUserName(userData?.name || "");
              setProfileModalOpen(true);
            }}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-2.5 py-1 cursor-pointer transition-all"
            title="Account & Voice Settings"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden border border-blue-400">
              <img
                src={userAvatarSrc}
                alt="User"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/default-user.svg";
                }}
              />
            </div>
            <span className="hidden sm:inline text-white text-xs font-semibold max-w-[80px] truncate">
              {userData?.name || "User"}
            </span>
            <IoMdSettings className="text-gray-300 w-4 h-4" />
          </div>

          {/* Mobile hamburger menu */}
          <button
            onClick={() => setHistoryOpen(true)}
            className="md:hidden text-white p-2 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
          >
            <IoMdMenu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Center Stage */}
      <main className="flex-1 w-full max-w-4xl flex flex-col items-center justify-center px-4 py-2 text-center z-10">
        {/* Assistant Avatar with glowing effects */}
        <div className="relative mb-5">
          <div
            className={`w-[190px] h-[190px] md:w-[230px] md:h-[230px] rounded-full overflow-hidden border-4 transition-all duration-500 shadow-2xl relative ${
              listening
                ? "border-emerald-400 shadow-[0_0_50px_rgba(52,211,153,0.6)] scale-105"
                : isSpeaking
                ? "border-blue-400 shadow-[0_0_50px_rgba(96,165,250,0.6)] scale-105"
                : isProcessing
                ? "border-purple-400 shadow-[0_0_40px_rgba(192,132,252,0.5)] animate-pulse"
                : "border-white/40 shadow-blue-900/50"
            }`}
          >
            <img
              src={assistantAvatarSrc}
              alt="Assistant"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/default-avatar.svg";
              }}
            />
          </div>

          {/* Voice Stop Button */}
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              title="Stop Speaking"
              className="absolute -bottom-2 right-4 bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-full shadow-lg border-2 border-white cursor-pointer animate-bounce"
            >
              <IoMdVolumeOff className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Assistant Name & Status */}
        <div className="flex items-center gap-2">
          <h2 className="text-white text-2xl md:text-3xl font-bold tracking-wide">
            {userData?.assistantName || "Assistant"}
          </h2>
          <button
            onClick={() => navigate("/customize")}
            className="text-gray-400 hover:text-blue-300 p-1 cursor-pointer transition-colors"
            title="Change Avatar & Name"
          >
            <MdOutlineEdit className="w-5 h-5" />
          </button>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mt-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              listening
                ? "bg-emerald-400 animate-ping"
                : isSpeaking
                ? "bg-blue-400 animate-pulse"
                : "bg-gray-400"
            }`}
          ></span>
          <span className="text-sm font-medium text-gray-200">{status}</span>
        </div>

        {/* Live Speech / Response Display */}
        <div className="min-h-[100px] w-full max-w-2xl mt-4 px-4 flex flex-col items-center justify-center">
          {userText && (
            <p className="text-blue-300 text-sm md:text-base font-medium bg-blue-950/60 px-4 py-1.5 rounded-xl border border-blue-400/30 mb-2 max-w-full truncate shadow">
              🗣️ "{userText}"
            </p>
          )}

          {isProcessing ? (
            <div className="flex items-center gap-2 text-purple-300 text-sm py-2">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
              <span>{isHindi ? "सोच रहे हैं..." : "Thinking..."}</span>
            </div>
          ) : aiText ? (
            <div className="flex flex-col items-center gap-2 max-w-full">
              <div className="relative group bg-white/10 backdrop-blur-md px-6 py-3.5 rounded-2xl border border-white/20 shadow-xl max-w-full">
                <p className="text-white text-base md:text-xl font-semibold text-center leading-relaxed">
                  {aiText}
                </p>

                {/* Quick actions for current response: Copy & Replay */}
                <div className="flex items-center justify-center gap-3 mt-3 pt-2 border-t border-white/10">
                  <button
                    onClick={() => handleCopyText(aiText)}
                    className="flex items-center gap-1 text-xs text-gray-300 hover:text-white px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 transition-all cursor-pointer"
                    title="Copy response to clipboard"
                  >
                    {copied ? (
                      <>
                        <IoMdCheckmark className="text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <IoMdCopy />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => speak(aiText)}
                    className="flex items-center gap-1 text-xs text-gray-300 hover:text-white px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 transition-all cursor-pointer"
                    title="Replay voice response"
                  >
                    <IoMdRefresh />
                    <span>Replay Voice</span>
                  </button>
                </div>
              </div>

              {/* Direct Website Launch Card */}
              {actionLink && (
                <div className="w-full max-w-md mt-2 flex flex-col items-center gap-2 p-3 bg-gradient-to-r from-blue-900/60 via-indigo-900/60 to-purple-900/60 rounded-2xl border border-blue-400/40 shadow-xl backdrop-blur-md animate-fadeIn">
                  <div className="flex items-center gap-2 text-white font-medium text-sm">
                    <span className="text-lg">🚀</span>
                    <span>
                      {isHindi
                        ? `${actionLink.title} खोला जा रहा है`
                        : `Opening ${actionLink.title}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full justify-center">
                    <a
                      href={actionLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold text-sm rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 border border-white/30 cursor-pointer"
                    >
                      <FaExternalLinkAlt className="w-3.5 h-3.5" />
                      <span>
                        {isHindi
                          ? `${actionLink.title} तुरंत खोलें ↗`
                          : `Launch ${actionLink.title} Now ↗`}
                      </span>
                    </a>
                  </div>

                  {actionLink.isBlocked && (
                    <p className="text-[11px] text-amber-300/90 text-center font-medium bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-400/20">
                      ℹ️{" "}
                      {isHindi
                        ? "ब्राउज़र ने नया टैब रोका हो सकता है। ऊपर दिए गए बटन को दबाकर खोलें।"
                        : "Browser blocked automatic pop-up. Tap the button above to open!"}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm italic">
              {isHindi
                ? "नीचे माइक दबाकर बोलें या त्वरित विकल्प चुनें"
                : "Tap the microphone below to talk or pick a suggestion"}
            </p>
          )}
        </div>

        {/* Quick Action Suggestion Chips */}
        <div className="w-full max-w-2xl flex flex-wrap justify-center gap-2 mt-4">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => executeCommand(action.cmd)}
              className="px-3.5 py-1.5 bg-white/5 hover:bg-white/15 border border-white/15 hover:border-blue-400/60 rounded-full text-xs md:text-sm text-gray-200 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              {action.label}
            </button>
          ))}
        </div>
      </main>

      {/* Bottom Bar: Mic Button & Text Input */}
      <footer className="w-full max-w-2xl px-4 pb-6 flex flex-col items-center gap-3 z-20">
        <form
          onSubmit={handleFormSubmit}
          className="w-full flex items-center gap-2 bg-[#00000075] backdrop-blur-xl border border-white/20 rounded-full p-2 shadow-2xl focus-within:border-blue-400"
        >
          {/* Mic Toggle Button */}
          <button
            type="button"
            onClick={toggleMic}
            title={listening ? "Stop Mic" : "Start Voice"}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg shrink-0 ${
              listening
                ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {listening ? (
              <IoMdMicOff className="w-6 h-6" />
            ) : (
              <IoMdMic className="w-6 h-6" />
            )}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isHindi
                ? "यहाँ लिखें या बोलें: 'फ्लिपकार्ट खोलो', 'अमेज़न', 'मौसम'..."
                : "Type or speak: 'Open Flipkart', 'Amazon', 'Weather'..."
            }
            className="flex-1 bg-transparent text-white placeholder-gray-400 text-sm md:text-base outline-none px-2"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <IoMdSend className="w-5 h-5" />
          </button>
        </form>

        <p className="text-[11px] text-gray-400 text-center">
          {isHindi
            ? "टिप: आप 'फ्लिपकार्ट खोलो', 'अमेज़न पर जूते खोजो', 'स्वीगी खोलो', या 'क्रिकबज़' बोल सकते हैं।"
            : "Tip: Say 'Open Flipkart', 'Search shoes on Amazon', 'Open Swiggy', or 'Open Cricbuzz'."}
        </p>
      </footer>

      {/* Slide-over Conversation Chat Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-full max-w-md bg-[#06061f]/95 backdrop-blur-2xl border-r border-white/20 p-5 z-50 flex flex-col justify-between transition-transform duration-300 shadow-2xl ${
          chatDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between pb-4 border-b border-white/20">
            <div className="flex items-center gap-2 text-white">
              <FaComments className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-lg">Conversation Log</h3>
            </div>
            <button
              onClick={() => setChatDrawerOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <ImCross className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {conversation.length > 0 ? (
              conversation.map((msg) => (
                <div key={msg.id} className="space-y-2">
                  {msg.userText && (
                    <div className="flex items-start gap-2 justify-end">
                      <div className="bg-blue-600/80 text-white text-xs md:text-sm px-3.5 py-2 rounded-2xl rounded-tr-none max-w-[80%] shadow">
                        <p>{msg.userText}</p>
                        <span className="text-[10px] text-blue-200 block text-right mt-1">
                          {msg.timestamp}
                        </span>
                      </div>
                      <div className="w-6 h-6 rounded-full overflow-hidden border border-blue-400 shrink-0">
                        <img
                          src={userAvatarSrc}
                          alt="User"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}

                  {msg.aiText && (
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full overflow-hidden border border-cyan-400 shrink-0">
                        <img
                          src={assistantAvatarSrc}
                          alt="AI"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="bg-white/10 text-white text-xs md:text-sm px-3.5 py-2 rounded-2xl rounded-tl-none max-w-[85%] border border-white/10 shadow">
                        <p>{msg.aiText}</p>
                        {msg.actionLink && (
                          <a
                            href={msg.actionLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/60 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
                          >
                            <FaExternalLinkAlt className="w-2.5 h-2.5" />
                            <span>{msg.actionLink.title}</span>
                          </a>
                        )}
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/10 text-[10px] text-gray-300">
                          <span>{userData?.assistantName || "AI"}</span>
                          <button
                            onClick={() => handleCopyText(msg.aiText)}
                            className="hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                          >
                            <IoMdCopy /> Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm text-center py-10">
                No conversation history yet. Talk to your assistant!
              </p>
            )}
          </div>

          {conversation.length > 0 && (
            <button
              onClick={clearConversation}
              className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-gray-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition-all"
            >
              Clear Conversation View
            </button>
          )}
        </div>
      </div>

      {/* Slide-over History Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-sm bg-[#06061f]/95 backdrop-blur-2xl border-l border-white/20 p-6 z-50 flex flex-col justify-between transition-transform duration-300 shadow-2xl ${
          historyOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-white/20">
            <div className="flex items-center gap-2 text-white">
              <FaHistory className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-lg">
                {isHindi ? "निर्देश इतिहास" : "Command History"}
              </h3>
            </div>
            <button
              onClick={() => setHistoryOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <ImCross className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Mobile Navigation */}
          <div className="md:hidden flex flex-col gap-2 my-4">
            <button
              onClick={() => {
                setHistoryOpen(false);
                setChatDrawerOpen(true);
              }}
              className="w-full py-2 bg-blue-600/60 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <FaComments /> View Conversation Chat
            </button>
            <button
              onClick={() => {
                setHistoryOpen(false);
                navigate("/customize");
              }}
              className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <MdOutlineEdit />{" "}
              {isHindi ? "असिस्टेंट कस्टमाइज़ करें" : "Customize Assistant"}
            </button>
            <button
              onClick={handleLogOut}
              className="w-full py-2 bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              {isHindi ? "लॉग आउट" : "Log Out"}
            </button>
          </div>

          {/* History List */}
          <div className="mt-4 flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {userData?.history && userData.history.length > 0 ? (
              userData.history.map((item, index) => (
                <div
                  key={index}
                  onClick={() => {
                    executeCommand(item);
                    setHistoryOpen(false);
                  }}
                  className="p-3 bg-white/5 hover:bg-white/15 rounded-xl border border-white/10 text-gray-200 text-sm cursor-pointer transition-all flex items-center justify-between group"
                >
                  <span className="truncate pr-2">{item}</span>
                  <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isHindi ? "चलाएं" : "Run"}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">
                {isHindi ? "कोई पुराना इतिहास नहीं है।" : "No command history yet."}
              </p>
            )}
          </div>
        </div>

        {userData?.history && userData.history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="w-full py-3 bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all mt-4"
          >
            <IoMdTrash className="w-5 h-5" />
            {isHindi ? "इतिहास साफ़ करें" : "Clear All History"}
          </button>
        )}
      </div>

      {/* User Profile & Voice Settings Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0a28] border border-white/20 rounded-3xl p-6 shadow-2xl relative text-white">
            <button
              onClick={() => setProfileModalOpen(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <ImCross className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FaUserCircle className="text-blue-400" />
              <span>User Profile & Settings</span>
            </h3>

            {/* Profile Avatar & Upload */}
            <div className="flex flex-col items-center mb-5">
              <div
                className="relative group w-24 h-24 rounded-full overflow-hidden border-4 border-blue-500/70 shadow-lg cursor-pointer"
                onClick={() => userFileInputRef.current?.click()}
              >
                <img
                  src={userAvatarSrc}
                  alt="User Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/default-user.svg";
                  }}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-[11px]">
                  <MdPhotoCamera className="w-6 h-6 mb-1" />
                  <span>Change</span>
                </div>
              </div>
              <input
                type="file"
                ref={userFileInputRef}
                hidden
                accept="image/*"
                onChange={handleUserProfileImageChange}
              />
              <span className="text-xs text-gray-300 mt-2">
                Click photo to change your profile picture
              </span>
            </div>

            {/* User Name input */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Your Name</label>
                <input
                  type="text"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full bg-white/5 border border-white/20 focus:border-blue-400 rounded-xl px-4 py-2.5 text-white text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Email</label>
                <input
                  type="email"
                  value={userData?.email || ""}
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-gray-400 text-sm cursor-not-allowed"
                />
              </div>

              {/* Voice Speed Slider */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Voice Speed</span>
                  <span>{voiceRate}x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.25"
                  value={voiceRate}
                  onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Voice Pitch Slider */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Voice Pitch</span>
                  <span>{voicePitch}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={voicePitch}
                  onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>

            {profileSuccessMsg && (
              <p className="text-emerald-400 text-xs text-center mb-3">
                {profileSuccessMsg}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveUserProfile}
                disabled={savingProfile}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer shadow disabled:opacity-50"
              >
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
              <button
                onClick={handleLogOut}
                className="px-4 py-2.5 bg-red-600/80 hover:bg-red-600 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Notes Modal */}
      {notesOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0a28] border border-white/20 rounded-3xl p-6 shadow-2xl relative text-white">
            <button
              onClick={() => setNotesOpen(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <ImCross className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
              <FaStickyNote className="text-amber-400" />
              <span>Voice & Quick Notes</span>
            </h3>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Type or dictate a note..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddNote(newNoteText);
                }}
                className="flex-1 bg-white/5 border border-white/20 focus:border-amber-400 rounded-xl px-4 py-2 text-white text-sm outline-none"
              />
              <button
                onClick={() => handleAddNote(newNoteText)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs cursor-pointer"
              >
                Add
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {notesList.length > 0 ? (
                notesList.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="text-gray-100 font-medium">{note.text}</p>
                      <span className="text-[10px] text-gray-400">{note.date}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                    >
                      <IoMdTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-xs text-center py-6">
                  No saved notes yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Backdrop overlay for drawers */}
      {(historyOpen || chatDrawerOpen) && (
        <div
          onClick={() => {
            setHistoryOpen(false);
            setChatDrawerOpen(false);
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        />
      )}
    </div>
  );
};

export default Home;
