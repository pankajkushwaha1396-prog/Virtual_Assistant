import express from "express";
import {
  askToAssistant,
  getCurrentUser,
  updateAssistant,
  clearUserHistory,
} from "../controllers/user.controller.js";
import isAuth from "../middlewares/isAuth.js";
import upload from "../middlewares/multer.js";

const userRouter = express.Router();

userRouter.get("/current", isAuth, getCurrentUser);
userRouter.post("/update", isAuth, upload.single("image"), updateAssistant);
userRouter.post("/askassistant", isAuth, askToAssistant);
userRouter.delete("/history", isAuth, clearUserHistory);

export default userRouter;
