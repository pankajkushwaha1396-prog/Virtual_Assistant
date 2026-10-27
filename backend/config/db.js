import mongoose from "mongoose";

const connectDb = async () => {
  try {
    console.log("Mongo URL Exists:", !!process.env.MONGODB_URL);

    await mongoose.connect(process.env.MONGODB_URL);

    console.log("db connected");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    throw error;
  }
};

export default connectDb;
