import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdArrowBack } from "react-icons/md";
import axios from "axios";
import { userDataContext } from "../context/UserContext";

const Customize2 = () => {
  const { userData, backendImage, selectedImage, serverUrl, setUserData } =
    useContext(userDataContext);
  const [assistantName, setAssistantName] = useState(
    userData?.assistantName || ""
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

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
        error.response?.data?.message || "Failed to save assistant settings."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-t from-black to-[#030353] flex justify-center items-center flex-col p-6 relative">
      <MdArrowBack
        className="absolute top-6 left-6 cursor-pointer text-white w-7 h-7 hover:text-blue-300 transition-colors"
        onClick={() => navigate("/customize")}
      />

      <div className="text-center mb-6">
        <h1 className="text-white text-3xl md:text-4xl font-bold">
          Name Your <span className="text-blue-400">Assistant</span>
        </h1>
        <p className="text-gray-300 text-sm md:text-base mt-2">
          Give your AI voice assistant a friendly name (e.g., Shifra, Jarvis, Maya)
        </p>
      </div>

      <div className="w-full max-w-[500px] flex flex-col items-center gap-4">
        <input
          type="text"
          placeholder="e.g., Shifra or जार्विस"
          className="w-full h-[60px] outline-none border-2 border-white/60 focus:border-blue-400 bg-transparent text-white placeholder-gray-400 px-6 rounded-full text-xl text-center transition-colors"
          required
          maxLength={30}
          onChange={(e) => setAssistantName(e.target.value)}
          value={assistantName}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleUpdateAssistant();
          }}
        />

        {errorMsg && (
          <p className="text-red-400 text-sm bg-red-950/50 px-4 py-2 rounded-lg border border-red-500/40 w-full text-center">
            {errorMsg}
          </p>
        )}

        <button
          className="w-full h-[60px] mt-4 text-black font-semibold cursor-pointer bg-white hover:bg-blue-300 transition-colors rounded-full text-xl shadow-lg disabled:opacity-50"
          disabled={loading || !assistantName.trim()}
          onClick={handleUpdateAssistant}
        >
          {loading ? "Saving Assistant..." : "Launch Your Assistant 🚀"}
        </button>
      </div>
    </div>
  );
};

export default Customize2;
