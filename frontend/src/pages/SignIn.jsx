import React, { useContext, useState } from "react";
import bg from "../assets/authBg.png";
import { IoEye, IoEyeOff } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { userDataContext } from "../context/UserContext.jsx";
import axios from "axios";

const SignIn = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { serverUrl, setUserData } = useContext(userDataContext);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const result = await axios.post(
        `${serverUrl}/api/auth/signin`,
        { email, password },
        { withCredentials: true }
      );
      setUserData(result.data);
      setLoading(false);
      navigate("/");
    } catch (error) {
      console.error(error);
      setUserData(null);
      setLoading(false);
      setErr(error.response?.data?.message || "Sign in failed. Please try again.");
    }
  };

  return (
    <div
      className="w-full h-screen bg-cover bg-center flex justify-center items-center p-4"
      style={{ backgroundImage: `url(${bg})` }}
    >
      <form
        className="w-[90%] max-w-[480px] bg-[#00000075] backdrop-blur-md rounded-2xl border border-white/20
        shadow-2xl shadow-black flex flex-col items-center justify-center gap-5 p-8"
        onSubmit={handleSignIn}
      >
        <h1 className="text-white text-3xl font-semibold mb-4 text-center">
          Sign In to <span className="text-blue-400">Virtual Assistant</span>
        </h1>

        <input
          type="email"
          placeholder="Email address"
          className="w-full h-[55px] outline-none border-2 border-white/60 focus:border-blue-400
          bg-transparent text-white placeholder-gray-300 px-5 rounded-full text-lg transition-colors"
          required
          onChange={(e) => setEmail(e.target.value)}
          value={email}
        />

        <div className="w-full h-[55px] border-2 border-white/60 focus-within:border-blue-400
        bg-transparent text-white placeholder-gray-300 px-5 rounded-full text-lg relative flex items-center">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            className="w-full h-full rounded-full outline-none bg-transparent placeholder-gray-300 pr-10"
            required
            onChange={(e) => setPassword(e.target.value)}
            value={password}
          />

          {!showPassword ? (
            <IoEye
              className="absolute right-5 w-6 h-6 text-gray-300 hover:text-white cursor-pointer"
              onClick={() => setShowPassword(true)}
            />
          ) : (
            <IoEyeOff
              className="absolute right-5 w-6 h-6 text-gray-300 hover:text-white cursor-pointer"
              onClick={() => setShowPassword(false)}
            />
          )}
        </div>

        {err && (
          <p className="text-red-400 text-sm font-medium text-center bg-red-950/50 px-4 py-2 rounded-lg border border-red-500/40 w-full">
            {err}
          </p>
        )}

        <button
          type="submit"
          className="w-full h-[55px] mt-2 text-black font-semibold bg-white hover:bg-blue-200 transition-colors rounded-full text-lg cursor-pointer disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p
          className="text-white text-base cursor-pointer hover:underline text-center mt-2"
          onClick={() => navigate("/signup")}
        >
          Want to create a new account?{" "}
          <span className="text-blue-400 font-semibold">Sign Up</span>
        </p>
      </form>
    </div>
  );
};

export default SignIn;
