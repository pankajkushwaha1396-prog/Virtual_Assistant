import React, { useContext, useRef } from "react";
import Card from "../components/Card";
import image1 from "../assets/image1.png";
import image2 from "../assets/image2.jpg";
import image3 from "../assets/authBg.png";
import image4 from "../assets/image4.png";
import image5 from "../assets/image5.png";
import image6 from "../assets/image6.jpeg";
import image7 from "../assets/image7.jpeg";

import { RiImageUploadFill } from "react-icons/ri";
import { userDataContext } from "../context/UserContext";
import { useNavigate } from "react-router-dom";
import { MdArrowBack } from "react-icons/md";

const Customize = () => {
  const {
    userData,
    setBackendImage,
    frontendImage,
    setFrontendImage,
    selectedImage,
    setSelectImage,
  } = useContext(userDataContext);

  const navigate = useNavigate();
  const inputImage = useRef();

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBackendImage(file);
    const previewUrl = URL.createObjectURL(file);
    setFrontendImage(previewUrl);
    setSelectImage("custom");
  };

  const images = [
    { id: 1, src: image1 },
    { id: 2, src: image2 },
    { id: 3, src: image3 },
    { id: 4, src: image4 },
    { id: 5, src: image5 },
    { id: 6, src: image6 },
    { id: 7, src: image7 },
  ];

  return (
    <div className="w-full min-h-screen bg-gradient-to-t from-black to-[#030353] flex justify-center items-center flex-col p-6 relative overflow-y-auto">
      {userData?.assistantImage && (
        <MdArrowBack
          className="absolute top-6 left-6 cursor-pointer text-white w-7 h-7 hover:text-blue-300 transition-colors"
          onClick={() => navigate("/")}
        />
      )}

      <div className="text-center mb-8">
        <h1 className="text-white text-3xl md:text-4xl font-bold">
          Choose Your <span className="text-blue-400">Assistant Avatar</span>
        </h1>
        <p className="text-gray-300 text-sm md:text-base mt-2">
          Select a default avatar or upload your own custom photo
        </p>
      </div>

      <div className="w-full max-w-4xl flex justify-center items-center flex-wrap gap-4 md:gap-6">
        {images.map((item) => (
          <Card key={item.id} image={item.src} />
        ))}

        {/* Custom Upload Card */}
        <div
          className={`w-[80px] sm:w-[120px] lg:w-[150px] h-[140px] sm:h-[200px] lg:h-[240px] bg-[#030326] border-2 rounded-2xl overflow-hidden hover:shadow-xl cursor-pointer flex flex-col items-center justify-center p-2 transition-all ${
            selectedImage === "custom"
              ? "border-4 border-blue-400 shadow-2xl shadow-blue-500/50 scale-105"
              : "border-blue-500/40 hover:border-white"
          }`}
          onClick={() => {
            inputImage.current.click();
          }}
        >
          {frontendImage ? (
            <img
              src={frontendImage}
              alt="Custom Avatar"
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-center text-gray-300">
              <RiImageUploadFill className="text-white w-8 h-8" />
              <span className="text-xs font-medium">Upload Image</span>
            </div>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          ref={inputImage}
          hidden
          onChange={handleImage}
        />
      </div>

      {selectedImage && (
        <button
          className="min-w-[180px] h-[55px] mt-8 text-black font-semibold cursor-pointer bg-white hover:bg-blue-300 transition-all rounded-full text-lg shadow-lg"
          onClick={() => navigate("/customize2")}
        >
          Continue to Name &rarr;
        </button>
      )}
    </div>
  );
};

export default Customize;
