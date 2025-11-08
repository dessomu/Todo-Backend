const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  userId: { type: String },
  sessionId: { type: String, index: true }, // random session marker
  createdAt: { type: Date, default: Date.now, expires: "2h" }, // auto cleanup
});

const Session = mongoose.model("Session", sessionSchema);

module.exports = Session;
