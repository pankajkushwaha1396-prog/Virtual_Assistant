import React, { useContext, useRef, useEffect, useState } from "react";
import Card from "../components/Card";
import { RiImageUploadFill } from "react-icons/ri";
import { userDataContext } from "../context/UserContext";
import { useNavigate } from "react-router-dom";
import { MdArrowBack } from "react-icons/md";
import { AVATAR_PRESETS } from "../utils/avatarUtils";

const Customize = () => {
  const {
    userData,
    backendImage,
    setBackendImage,
    frontendImage,
    setFrontendImage,
    selectedImage,
    setSelectImage,
  } = useContext(userDataContext);

  const navigate = useNavigate();
  const inputImage = useRef(null);
  const [uploadError, setUploadError] = useState("");

  // Initialize selected image with user's current avatar if not already set
  useEffect(() => {
    if (!selectedImage && userData?.assistantImage) {
      setSelectImage(userData.assistantImage);
    }
  }, [userData?.assistantImage, selectedImage, setSelectImage]);

  const handleImage = (e) => {
    setUploadError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a valid image file (PNG, JPG, WEBP, GIF).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setUploadError("Image size must be less than 8MB.");
      return;
    }

    setBackendImage(file);
    const previewUrl = URL.createObjectURL(file);
    setFrontendImage(previewUrl);
    setSelectImage("custom");
  };

  const isCustomSelected = selectedImage === "custom" || Boolean(backendImage);

  return (
    <div className="w-full min-h-screen bg-gradient-to-t from-black via-[#040438] to-[#030353] flex justify-center items-center flex-col p-6 relative overflow-y-auto">
      {/* Back button to Home if user already has an assistant configured */}
      {userData?.assistantImage && userData?.assistantName && (
        <button
          onClick={() => navigate("/")}
          className="absolute top-6 left-6 cursor-pointer text-white/80 hover:text-white flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-full backdrop-blur-md border border-white/20 transition-all z-20"
        >
          <MdArrowBack className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Assistant</span>
        </button>
      )}

      <div className="text-center mb-8 mt-12 md:mt-0">
        <h1 className="text-white text-3xl md:text-5xl font-extrabold tracking-tight">
          Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Assistant Avatar</span>
        </h1>
        <p className="text-gray-300 text-sm md:text-base mt-3 max-w-xl mx-auto">
          Select from our curated AI holograms and robotic avatars, or upload a personalized image from your device.
        </p>
      </div>

      {uploadError && (
        <div className="mb-4 text-red-300 bg-red-950/70 border border-red-500/50 px-4 py-2 rounded-xl text-sm">
          {uploadError}
        </div>
      )}

      {/* Grid of Avatars */}
      <div className="w-full max-w-5xl flex justify-center items-center flex-wrap gap-4 md:gap-6 p-2">
        {AVATAR_PRESETS.map((preset) => (
          <Card
            key={preset.id}
            image={preset.src}
            name={preset.name}
            isGif={preset.isGif}
          />
        ))}

        {/* Custom Upload Card */}
        <div
          className={`group relative w-[95px] sm:w-[130px] lg:w-[155px] h-[145px] sm:h-[195px] lg:h-[235px] bg-[#030326] border-2 rounded-2xl overflow-hidden hover:shadow-xl cursor-pointer flex flex-col items-center justify-center p-2 transition-all duration-300 ${
            isCustomSelected
              ? "border-4 border-blue-400 shadow-2xl shadow-blue-500/60 scale-105"
              : "border-blue-500/40 hover:border-white hover:scale-[1.02]"
          }`}
          onClick={() => {
            inputImage.current?.click();
          }}
          title="Click to upload custom avatar"
        >
          {frontendImage ? (
            <img
              src={frontendImage}
              alt="Custom Avatar"
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-center text-gray-300 p-2">
              <div className="w-12 h-12 rounded-full bg-blue-600/30 border border-blue-400/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <RiImageUploadFill className="text-blue-300 w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-white">Upload Custom</span>
              <span className="text-[10px] text-gray-400">JPG, PNG, GIF</span>
            </div>
          )}

          {isCustomSelected && (
            <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md">
              ✓
            </div>
          )}

          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 text-center">
            <span className="text-xs text-blue-300 font-medium">Custom Photo</span>
          </div>
        </div>

        <input
          type="file"
          accept="image/*"
          ref={inputImage}
          hidden
          onChange={handleImage}
        />
      </div>

      {/* Action CTA */}
      <div className="mt-8 flex flex-col items-center gap-3">
        {(selectedImage || backendImage) ? (
          <button
            className="min-w-[220px] h-[55px] px-8 text-black font-bold cursor-pointer bg-gradient-to-r from-white to-blue-100 hover:from-blue-200 hover:to-white transition-all duration-300 rounded-full text-lg shadow-xl shadow-blue-900/40 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            onClick={() => navigate("/customize2")}
          >
            <span>Continue to Name</span>
            <span>&rarr;</span>
          </button>
        ) : (
          <p className="text-gray-400 text-sm italic">
            Tap any avatar above to proceed
          </p>
        )}
      </div>
    </div>
  );
};

export default Customize;
