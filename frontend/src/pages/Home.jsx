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
  IoMdTrash,
} from "react-icons/io";
import { ImCross } from "react-icons/im";
import { FaHistory, FaExternalLinkAlt } from "react-icons/fa";
import { MdOutlineEdit } from "react-icons/md";

const Home = () => {
  const {
    userData,
    setUserData,
    serverUrl,
    getGeminiResponse,
    selectedLang,
    setSelectedLang,
    clearHistory,
  } = useContext(userDataContext);

  const navigate = useNavigate();

  const defaultAssistantImage = "/default-avatar.png";

  const assistantImage =
    typeof userData?.assistantImage === "string" &&
      userData.assistantImage.trim() !== ""
      ? userData.assistantImage
      : defaultAssistantImage;

  // Assistant states
  const [listening, setListening] = useState(false);
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [actionLink, setActionLink] = useState(null);

  // Refs
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const isRecognizingRef = useRef(false);
  const processingRef = useRef(false);
  const activeMicRef = useRef(false);
  const restartTimerRef = useRef(null);
  const speechTimeoutRef = useRef(null);
  const utteranceRef = useRef(null); // Prevents Chrome V8 GC bug

  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

  // Language configuration
  const isHindi = selectedLang === "hindi";
  const speechLangCode = isHindi ? "hi-IN" : "en-US";

  // Select the best voice with safe fallback
  const getPreferredVoice = (targetLang) => {
    if (!synth) return null;
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;

    if (targetLang === "hi-IN") {
      // 1. Exact Hindi voice
      const hindiVoice = voices.find(
        (v) =>
          v.lang.toLowerCase() === "hi-in" ||
          v.lang.toLowerCase().startsWith("hi") ||
          v.name.toLowerCase().includes("hindi")
      );
      if (hindiVoice) return hindiVoice;

      // 2. Indian English voice (reads Hindi script / Hinglish cleanly)
      const indianVoice = voices.find(
        (v) =>
          v.lang.toLowerCase() === "en-in" ||
          v.name.toLowerCase().includes("india")
      );
      if (indianVoice) return indianVoice;
    }

    // Default English / system voice
    return (
      voices.find((v) => v.lang.toLowerCase() === "en-us") ||
      voices.find((v) => v.default) ||
      voices[0]
    );
  };

  // Safe restart of speech recognition
  const scheduleRestart = () => {
    clearTimeout(restartTimerRef.current);
    if (!activeMicRef.current || isSpeakingRef.current || processingRef.current) {
      return;
    }

    restartTimerRef.current = setTimeout(() => {
      startRecognition();
    }, 600);
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
        console.error("Recognition start error:", error);
      }
    }
  };

  const stopRecognition = () => {
    activeMicRef.current = false;
    clearTimeout(restartTimerRef.current);
    try {
      recognitionRef.current?.stop();
    } catch (_err) {
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

  // End speaking cleanup
  const finishSpeaking = () => {
    clearTimeout(speechTimeoutRef.current);
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    processingRef.current = false;
    setIsProcessing(false);
    utteranceRef.current = null;

    if (activeMicRef.current) {
      setStatus(isHindi ? "🎤 सुन रहा हूँ..." : "🎤 Listening...");
      scheduleRestart();
    } else {
      setStatus("Ready");
    }
  };

  // Stop speaking on demand
  const stopSpeaking = () => {
    clearTimeout(speechTimeoutRef.current);
    if (synth) {
      try {
        synth.cancel();
      } catch (_e) {
        // ignore
      }
    }
    finishSpeaking();
  };

  // Speak text with SpeechSynthesis + Garbage collection protection + Timeout fallback
  const speak = (text) => {
    if (!synth) {
      finishSpeaking();
      return;
    }

    if (!text || !text.trim()) {
      finishSpeaking();
      return;
    }

    // Stop mic recognition immediately before speaking so audio output isn't muted
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_err) {
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
    } catch (_e) {
      // ignore
    }

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utteranceRef.current = utterance; // Prevent GC in Chrome

    const preferredVoice = getPreferredVoice(speechLangCode);
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = speechLangCode;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setStatus(isHindi ? "🔊 सहायक बोल रहा है..." : "🔊 Assistant is speaking...");

    // Safety watchdog: Chrome sometimes drops onend for long utterances or GC
    clearTimeout(speechTimeoutRef.current);
    const estimatedDurationMs = Math.max(4000, (text.length / 8) * 1000 + 3000);
    speechTimeoutRef.current = setTimeout(() => {
      console.log("Watchdog timer resolved speaking state.");
      finishSpeaking();
    }, estimatedDurationMs);

    utterance.onend = () => {
      console.log("Speech utterance finished naturally.");
      finishSpeaking();
    };

    utterance.onerror = (event) => {
      console.error("Speech error occurred:", event.error);
      finishSpeaking();
    };

    // Small delay to allow audio device to switch from input to output cleanly
    setTimeout(() => {
      try {
        synth.speak(utterance);
      } catch (err) {
        console.error("synth.speak error:", err);
        finishSpeaking();
      }
    }, 150);
  };

  // Dispatch actions based on intent
  const handleCommandResult = (data) => {
    if (!data || typeof data !== "object") {
      finishSpeaking();
      return;
    }

    const { type, userInput = "", response = "" } = data;
    const cleanQuery = (userInput || "").trim();
    const query = encodeURIComponent(cleanQuery);
    let url = null;
    let linkTitle = "";

    switch (type) {
      case "google-open":
        url = "https://www.google.com/";
        linkTitle = isHindi ? "गूगल खोलें" : "Open Google";
        break;

      case "google-search":
        url = query
          ? `https://www.google.com/search?q=${query}`
          : "https://www.google.com/";
        linkTitle = cleanQuery
          ? `${cleanQuery} - Google Search`
          : "Google Search";
        break;

      case "youtube-open":
        url = "https://www.youtube.com/";
        linkTitle = isHindi ? "यूट्यूब खोलें" : "Open YouTube";
        break;

      case "youtube-search":
      case "youtube-play":
        url = query
          ? `https://www.youtube.com/results?search_query=${query}`
          : "https://www.youtube.com/";
        linkTitle = cleanQuery ? `YouTube: ${cleanQuery}` : "YouTube";
        break;

      case "calculator-open":
        url = "https://www.google.com/search?q=calculator";
        linkTitle = isHindi ? "कैलकुलेटर खोलें" : "Open Calculator";
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
        url = query
          ? `https://github.com/search?q=${query}`
          : "https://github.com/";
        linkTitle = cleanQuery ? `GitHub: ${cleanQuery}` : "GitHub";
        break;

      case "maps-open":
        url = query
          ? `https://www.google.com/maps/search/${query}`
          : "https://maps.google.com/";
        linkTitle = cleanQuery ? `Google Maps: ${cleanQuery}` : "Google Maps";
        break;

      case "news-open":
        url = query
          ? `https://news.google.com/search?q=${query}`
          : "https://news.google.com/";
        linkTitle = cleanQuery ? `News: ${cleanQuery}` : "Google News";
        break;

      case "wikipedia-open":
        url = query
          ? `https://${isHindi ? "hi" : "en"}.wikipedia.org/wiki/${query}`
          : `https://${isHindi ? "hi" : "en"}.wikipedia.org/`;
        linkTitle = cleanQuery ? `Wikipedia: ${cleanQuery}` : "Wikipedia";
        break;

      case "weather-show":
        url = query
          ? `https://www.google.com/search?q=weather+${query}`
          : "https://www.google.com/search?q=weather";
        linkTitle = isHindi ? "मौसम की जानकारी" : "Weather Info";
        break;

      default:
        break;
    }

    if (url) {
      setActionLink({ url, title: linkTitle });
      try {
        const opened = window.open(url, "_blank");
        if (!opened || opened.closed || typeof opened.closed === "undefined") {
          console.warn("Popup blocked by browser. Showing fallback button in UI.");
        }
      } catch (err) {
        console.warn("window.open exception:", err);
      }
    } else {
      setActionLink(null);
    }

    setAiText(response);
    speak(response);
  };

  // Process any command string (from voice or text input or quick chips)
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
      } catch (_err) {
        // ignore
      }
    }
    isRecognizingRef.current = false;
    setListening(false);

    try {
      const data = await getGeminiResponse(trimmed, selectedLang);
      console.log("Assistant Response:", data);

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
        handleCommandResult(data);
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

  // Quick suggestion chips
  const quickActions = [
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
      label: isHindi ? "⛅ मौसम कैसा है?" : "⛅ Weather",
      cmd: isHindi ? "आज का मौसम कैसा है?" : "Show today's weather",
    },
    {
      label: isHindi ? "🎥 यूट्यूब खोलो" : "🎥 Open YouTube",
      cmd: isHindi ? "यूट्यूब खोलो" : "Open YouTube",
    },
    {
      label: isHindi ? "🌐 गूगल खोलो" : "🌐 Open Google",
      cmd: isHindi ? "गूगल खोलो" : "Open Google",
    },
    {
      label: isHindi ? "💬 व्हाट्सएप" : "💬 WhatsApp",
      cmd: isHindi ? "व्हाट्सएप खोलो" : "Open WhatsApp",
    },
    {
      label: isHindi ? "🧮 कैलकुलेटर" : "🧮 Calculator",
      cmd: isHindi ? "कैलकुलेटर खोलो" : "Open Calculator",
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
        scheduleRestart();
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        // Normal silence event in Chrome, do not abort
        return;
      }

      console.error("Recognition error:", event.error);
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
      }
    };

    recognition.onresult = (event) => {
      const results = event.results;
      if (!results || results.length === 0) return;

      const transcript = results[results.length - 1][0].transcript.trim();

      if (!transcript || processingRef.current) return;

      console.log("Speech recognized:", transcript);
      executeCommand(transcript);
    };

    // Cache voices
    if (synth && synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = () => {
        synth.getVoices();
      };
    }

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
      } catch (_e) {
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

  return (
    <div className="w-full min-h-screen bg-gradient-to-t from-black via-[#04043b] to-[#01011e] flex flex-col justify-between items-center relative overflow-hidden select-none">
      {/* Top Navbar */}
      <header className="w-full max-w-6xl flex justify-between items-center p-4 md:px-8 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-400/80 shadow-md">
            <img
              src={assistantImage}
              alt="Avatar"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = defaultAssistantImage;
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
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <div className="flex bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20">
            <button
              onClick={() => setSelectedLang("hindi")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${isHindi
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-300 hover:text-white"
                }`}
            >
              🇮🇳 हिंदी
            </button>
            <button
              onClick={() => setSelectedLang("english")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${!isHindi
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-300 hover:text-white"
                }`}
            >
              🌐 English
            </button>
          </div>

          {/* Desktop buttons */}
          <button
            onClick={() => setHistoryOpen(true)}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-full border border-white/20 transition-all cursor-pointer"
          >
            <FaHistory /> {isHindi ? "इतिहास" : "History"}
          </button>

          <button
            onClick={() => navigate("/customize")}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-full border border-white/20 transition-all cursor-pointer"
          >
            <MdOutlineEdit /> {isHindi ? "बदलें" : "Customize"}
          </button>

          <button
            onClick={handleLogOut}
            className="hidden md:flex px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium rounded-full transition-all cursor-pointer shadow-md"
          >
            {isHindi ? "लॉग आउट" : "Log Out"}
          </button>

          {/* Mobile hamburger menu */}
          <button
            onClick={() => setHistoryOpen(true)}
            className="md:hidden text-white p-2 rounded-lg bg-white/10 hover:bg-white/20"
          >
            <IoMdMenu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Center Stage */}
      <main className="flex-1 w-full max-w-4xl flex flex-col items-center justify-center px-4 py-2 text-center z-10">
        {/* Assistant Avatar with glowing effects */}
        <div className="relative mb-6">
          <div
            className={`w-[200px] h-[200px] md:w-[240px] md:h-[240px] rounded-full overflow-hidden border-4 transition-all duration-500 shadow-2xl relative ${listening
                ? "border-emerald-400 shadow-[0_0_50px_rgba(52,211,153,0.6)] scale-105"
                : isSpeaking
                  ? "border-blue-400 shadow-[0_0_50px_rgba(96,165,250,0.6)] scale-105"
                  : isProcessing
                    ? "border-purple-400 shadow-[0_0_40px_rgba(192,132,252,0.5)] animate-pulse"
                    : "border-white/40 shadow-blue-900/50"
              }`}
          >
            <img
              src={assistantImage}
              alt="Assistant"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = defaultAssistantImage;
              }}
            />
          </div>

          {/* Sound wave / stop voice button */}
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              title="Stop Voice"
              className="absolute -bottom-2 right-4 bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-full shadow-lg border-2 border-white cursor-pointer animate-bounce"
            >
              <IoMdVolumeOff className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Assistant Name & Status */}
        <h2 className="text-white text-2xl md:text-3xl font-bold tracking-wide">
          {userData?.assistantName}
        </h2>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mt-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${listening
                ? "bg-emerald-400 animate-ping"
                : isSpeaking
                  ? "bg-blue-400 animate-pulse"
                  : "bg-gray-400"
              }`}
          ></span>
          <span className="text-sm font-medium text-gray-200">{status}</span>
        </div>

        {/* Live Speech / Response Display */}
        <div className="min-h-[90px] w-full max-w-2xl mt-4 px-4 flex flex-col items-center justify-center">
          {userText && (
            <p className="text-blue-300 text-sm md:text-base font-medium bg-blue-950/40 px-4 py-1.5 rounded-xl border border-blue-400/20 mb-2 max-w-full truncate">
              🗣️ "{userText}"
            </p>
          )}

          {isProcessing ? (
            <div className="flex items-center gap-2 text-purple-300 text-sm py-2">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
              <span>{isHindi ? "सोच रहे हैं..." : "Thinking..."}</span>
            </div>
          ) : aiText ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-white text-base md:text-xl font-semibold bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 shadow-lg text-center max-w-full">
                {aiText}
              </p>

              {/* Action Link Button (Open Web Result or if popup blocked) */}
              {actionLink && (
                <a
                  href={actionLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-full shadow-lg transition-all border border-blue-300/40 cursor-pointer"
                >
                  <FaExternalLinkAlt className="w-3.5 h-3.5" />
                  <span>{actionLink.title || (isHindi ? "यहाँ खोलें" : "Open Link")}</span>
                </a>
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
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg shrink-0 ${listening
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
                ? "यहाँ हिंदी या अंग्रेजी में लिखें या माइक से बोलें..."
                : "Type or speak a command in Hindi or English..."
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
            ? "टिप: आप 'यूट्यूब पर गाने बजाओ', 'गूगल खोलो', या 'मौसम दिखाओ' बोल सकते हैं।"
            : "Tip: Say 'Play songs on YouTube', 'Open Google', or 'Show weather'."}
        </p>
      </footer>

      {/* Slide-over History Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-sm bg-[#06061f]/95 backdrop-blur-2xl border-l border-white/20 p-6 z-50 flex flex-col justify-between transition-transform duration-300 shadow-2xl ${historyOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        <div>
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/20">
            <div className="flex items-center gap-2 text-white">
              <FaHistory className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-lg">
                {isHindi ? "निर्देश इतिहास" : "Command History"}
              </h3>
            </div>
            <button
              onClick={() => setHistoryOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg"
            >
              <ImCross className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Quick Navigation */}
          <div className="md:hidden flex flex-col gap-2 my-4">
            <button
              onClick={() => {
                setHistoryOpen(false);
                navigate("/customize");
              }}
              className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              <MdOutlineEdit /> {isHindi ? "असिस्टेंट कस्टमाइज़ करें" : "Customize Assistant"}
            </button>
            <button
              onClick={handleLogOut}
              className="w-full py-2.5 bg-red-600/80 hover:bg-red-600 text-white text-sm font-semibold rounded-xl"
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

        {/* Clear History Button */}
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

      {/* Drawer Overlay backdrop */}
      {historyOpen && (
        <div
          onClick={() => setHistoryOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        />
      )}
    </div>
  );
};

export default Home;
