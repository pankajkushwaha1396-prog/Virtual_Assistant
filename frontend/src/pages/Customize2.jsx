import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdArrowBack } from "react-icons/md";
import axios from "axios";
import { userDataContext } from "../context/UserContext";
import { resolveAvatar } from "../utils/avatarUtils";

const Customize2 = () => {
  const {
    userData,
    backendImage,
    frontendImage,
    selectedImage,
    serverUrl,
    setUserData,
  } = useContext(userDataContext);

  const [assistantName, setAssistantName] = useState(
    userData?.assistantName || "Shifra"
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  // Preview the chosen avatar
  const avatarPreview =
    frontendImage ||
    (selectedImage && selectedImage !== "custom"
      ? resolveAvatar(selectedImage)
      : resolveAvatar(userData?.assistantImage));

  const handleUpdateAssistant = async () => {
    if (!assistantName.trim()) {
      setErrorMsg("Please enter a name for your assistant.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("assistantName", assistantName.trim());

      if (backendImage) {
        formData.append("image", backendImage);
      } else if (selectedImage && selectedImage !== "custom") {
        formData.append("imageUrl", selectedImage);
      }

      const result = await axios.post(
        `${serverUrl}/api/user/update`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      setUserData(result.data);
      navigate("/");
    } catch (error) {
      console.error("Update assistant error:", error);
      setErrorMsg(
        error.response?.data?.message ||
          "Failed to save assistant settings. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-t from-black via-[#040438] to-[#030353] flex justify-center items-center flex-col p-6 relative">
      <button
        onClick={() => navigate("/customize")}
        className="absolute top-6 left-6 cursor-pointer text-white/80 hover:text-white flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-full backdrop-blur-md border border-white/20 transition-all z-20"
      >
        <MdArrowBack className="w-5 h-5" />
        <span className="text-sm font-medium">Change Avatar</span>
      </button>

      {/* Selected Avatar Preview Badge */}
      <div className="mb-4 relative group">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.5)]">
          <img
            src={avatarPreview}
            alt="Chosen Avatar"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/default-avatar.svg";
            }}
          />
        </div>
        <span className="absolute -bottom-2 inset-x-0 mx-auto w-max px-2.5 py-0.5 bg-blue-600 text-white text-[11px] font-bold rounded-full shadow">
          Selected
        </span>
      </div>

      <div className="text-center mb-6">
        <h1 className="text-white text-3xl md:text-5xl font-extrabold">
          Name Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Assistant</span>
        </h1>
        <p className="text-gray-300 text-sm md:text-base mt-2 max-w-md mx-auto">
          Give your companion an identity (e.g. Shifra, Jarvis, Maya, Nova, or जार्विस)
        </p>
      </div>

      <div className="w-full max-w-[500px] flex flex-col items-center gap-4">
        <input
          type="text"
          placeholder="e.g. Shifra, Jarvis, or जार्विस"
          className="w-full h-[60px] outline-none border-2 border-white/50 focus:border-blue-400 bg-white/5 text-white placeholder-gray-400 px-6 rounded-full text-xl text-center backdrop-blur-md transition-all shadow-lg"
          required
          maxLength={30}
          onChange={(e) => setAssistantName(e.target.value)}
          value={assistantName}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleUpdateAssistant();
          }}
          autoFocus
        />

        {errorMsg && (
          <p className="text-red-300 text-sm bg-red-950/70 px-4 py-2 rounded-xl border border-red-500/50 w-full text-center">
            {errorMsg}
          </p>
        )}

        <button
          className="w-full h-[60px] mt-2 text-black font-bold cursor-pointer bg-gradient-to-r from-white to-blue-100 hover:from-blue-200 hover:to-white transition-all rounded-full text-xl shadow-xl shadow-blue-900/40 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          disabled={loading || !assistantName.trim()}
          onClick={handleUpdateAssistant}
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              <span>Saving Assistant...</span>
            </>
          ) : (
            <span>Launch Your Assistant 🚀</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Customize2;
