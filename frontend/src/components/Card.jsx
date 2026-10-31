import React, { useContext } from "react";
import { userDataContext } from "../context/UserContext";
import { resolveAvatar } from "../utils/avatarUtils";

const Card = ({ image, name, isGif }) => {
  const {
    setBackendImage,
    setFrontendImage,
    selectedImage,
    setSelectImage,
  } = useContext(userDataContext);

  const resolved = resolveAvatar(image);
  const isSelected =
    selectedImage === image ||
    (selectedImage && resolveAvatar(selectedImage) === resolved);

  return (
    <div
      className={`group relative w-[95px] sm:w-[130px] lg:w-[155px] h-[145px] sm:h-[195px] lg:h-[235px] bg-[#030326] border-2 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
        isSelected
          ? "border-4 border-blue-400 shadow-2xl shadow-blue-500/60 scale-105"
          : "border-blue-500/40 hover:border-white hover:scale-[1.02] hover:shadow-xl"
      }`}
      onClick={() => {
        setSelectImage(image);
        setBackendImage(null);
        setFrontendImage(null);
      }}
    >
      <img
        src={resolved}
        alt={name || "Avatar option"}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = "/default-avatar.svg";
        }}
      />

      {/* Selected Indicator Checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md">
          ✓
        </div>
      )}

      {/* Label Overlay */}
      {name && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 text-center">
          <span className="text-white text-xs sm:text-sm font-semibold truncate block">
            {name}
          </span>
          {isGif && (
            <span className="text-[10px] text-blue-300 uppercase tracking-widest font-bold">
              Animated
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Card;
