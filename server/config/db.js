require("dotenv").config();
const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected ", process.env.MONGO_URI);
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
  }
}

module.exports = connectDB;
