const mongoose = require("mongoose");

const todoSchema = new mongoose.Schema({
  todo: { type: String, required: true },
  completed: { type: Boolean, default: false },
  userId: { type: String, required: true }, // Firebase UID
  createdAt: { type: Date, default: Date.now },
});

const Todo = mongoose.model("Todos", todoSchema);

module.exports = Todo;
