import express from "express";
import dotenv from "dotenv";
dotenv.config();

import connectDb from "./config/db.js";
import authRouter from "./routes/auth.routes.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.routes.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://virtual-assistant-tjmy.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

const port = process.env.PORT || 8000;

app.use(express.json());
app.use(cookieParser());

// Serve static public folder if needed
app.use("/public", express.static("public"));

// Routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "AI Assistant Server is running" });
});


const startServer = async () => {
  try {
    await connectDb();

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.log(error);
  }
};

startServer();