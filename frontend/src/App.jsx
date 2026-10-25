import React, { useContext } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import Customize from "./pages/Customize";
import Customize2 from "./pages/Customize2";
import Home from "./pages/Home";
import { userDataContext } from "./context/UserContext";

const App = () => {
  const { userData, loadingUser } = useContext(userDataContext);

  if (loadingUser) {
    return (
      <div className="w-full h-screen bg-gradient-to-t from-black to-[#030353] flex flex-col justify-center items-center gap-4 text-white">
        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-lg font-medium text-blue-200">Starting Assistant...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          userData && userData.assistantImage && userData.assistantName ? (
            <Home />
          ) : userData ? (
            <Navigate to="/customize" replace />
          ) : (
            <Navigate to="/signin" replace />
          )
        }
      />
      <Route
        path="/signup"
        element={!userData ? <SignUp /> : <Navigate to="/" replace />}
      />
      <Route
        path="/signin"
        element={!userData ? <SignIn /> : <Navigate to="/" replace />}
      />
      <Route
        path="/customize"
        element={userData ? <Customize /> : <Navigate to="/signin" replace />}
      />
      <Route
        path="/customize2"
        element={userData ? <Customize2 /> : <Navigate to="/signin" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
