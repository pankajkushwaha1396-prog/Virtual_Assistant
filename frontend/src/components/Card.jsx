import React, { useContext } from "react";
import { userDataContext } from "../context/UserContext";

const Card = ({ image }) => {
  const {
    setBackendImage,
    setFrontendImage,
    selectedImage,
    setSelectImage,
  } = useContext(userDataContext);

  const isSelected = selectedImage === image;

  return (
    <div
      className={`w-[80px] sm:w-[120px] lg:w-[150px] h-[140px] sm:h-[200px] lg:h-[240px] bg-[#030326] border-2 rounded-2xl overflow-hidden cursor-pointer transition-all ${
        isSelected
          ? "border-4 border-blue-400 shadow-2xl shadow-blue-500/50 scale-105"
          : "border-blue-500/40 hover:border-white hover:shadow-xl"
      }`}
      onClick={() => {
        setSelectImage(image);
        setBackendImage(null);
        setFrontendImage(null);
      }}
    >
      <img
        src={image}
        alt="Avatar option"
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default Card;
