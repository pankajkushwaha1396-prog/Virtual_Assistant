import mongoose from "mongoose";

const connectDb = async () => {
  try {
    console.log("MONGODB_URL =", process.env.MONGODB_URL ? "FOUND" : "NOT FOUND");

    await mongoose.connect(process.env.MONGODB_URL);

    console.log("✅ DB CONNECTED");
  } catch (error) {
    console.error("❌ DATABASE ERROR:", error);
  }
};

export default connectDb;