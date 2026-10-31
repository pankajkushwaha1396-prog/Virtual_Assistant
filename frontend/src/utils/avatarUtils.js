import image1 from "../assets/image1.png";
import image2 from "../assets/image2.jpg";
import image4 from "../assets/image4.png";
import image5 from "../assets/image5.png";
import image6 from "../assets/image6.jpeg";
import image7 from "../assets/image7.jpeg";
import aiGif from "../assets/ai.gif";
import userGif from "../assets/user.gif";

export const DEFAULT_ASSISTANT_AVATAR = "/default-avatar.svg";
export const DEFAULT_USER_AVATAR = "/default-user.svg";

// Preset avatars available to choose
export const AVATAR_PRESETS = [
  { id: "ai-glow", name: "Cyber AI", src: aiGif, isGif: true },
  { id: "avatar-1", name: "Nova", src: image1 },
  { id: "avatar-2", name: "Aria", src: image2 },
  { id: "avatar-4", name: "Jarvis", src: image4 },
  { id: "avatar-5", name: "Echo", src: image5 },
  { id: "avatar-6", name: "Kira", src: image6 },
  { id: "avatar-7", name: "Zenith", src: image7 },
  { id: "avatar-user", name: "Atlas", src: userGif, isGif: true },
];

/**
 * Robust avatar resolver:
 * Handles remote URLs (Cloudinary/backend static), blob URLs (live preview),
 * bundled assets, legacy `/src/assets/...` paths, and fallback.
 */
export const resolveAvatar = (avatarUrl) => {
  if (!avatarUrl || typeof avatarUrl !== "string" || !avatarUrl.trim()) {
    return DEFAULT_ASSISTANT_AVATAR;
  }

  const trimmed = avatarUrl.trim();

  // 1. Data URLs or object previews
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return trimmed;
  }

  // 2. Full HTTP/HTTPS URLs (Cloudinary or backend uploads)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // 3. Match against known presets by id or path keyword
  if (trimmed === "ai-glow" || trimmed.includes("ai.gif")) return aiGif;
  if (trimmed === "avatar-1" || trimmed.includes("image1")) return image1;
  if (trimmed === "avatar-2" || trimmed.includes("image2")) return image2;
  if (trimmed === "avatar-4" || trimmed.includes("image4")) return image4;
  if (trimmed === "avatar-5" || trimmed.includes("image5")) return image5;
  if (trimmed === "avatar-6" || trimmed.includes("image6")) return image6;
  if (trimmed === "avatar-7" || trimmed.includes("image7")) return image7;
  if (trimmed === "avatar-user" || trimmed.includes("user.gif")) return userGif;

  // 4. Check if it matches preset src directly
  const found = AVATAR_PRESETS.find((p) => p.src === trimmed || p.id === trimmed);
  if (found) return found.src;

  // 5. If it starts with / or is a relative URL
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return DEFAULT_ASSISTANT_AVATAR;
};

/**
 * Resolves user profile picture
 */
export const resolveUserAvatar = (userUrl) => {
  if (!userUrl || typeof userUrl !== "string" || !userUrl.trim()) {
    return DEFAULT_USER_AVATAR;
  }
  return resolveAvatar(userUrl);
};
