import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

const uploadOnCloudinary = async (filePath) => {
  // Only attempt if credentials look plausible
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    console.warn("Cloudinary credentials incomplete in .env. Falling back to local storage.");
    return null;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  try {
    if (!filePath || !fs.existsSync(filePath)) return null;

    const uploadResult = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
      folder: "virtual_assistant",
    });

    // Successfully uploaded to Cloudinary, remove the local copy
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_e) {
        // ignore unlink error
      }
    }
    return uploadResult.secure_url;
  } catch (error) {
    console.warn("Cloudinary upload failed (will use local file fallback):", error.message);
    // Keep local file intact for fallback serving!
    return null;
  }
};

export default uploadOnCloudinary;
