require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const Todo = require("./models/todo");
const Session = require("./models/session");
const authMiddleware = require("./middlewares/authMiddleware");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const admin = require("./config/firebaseAdmin");
const jwt = require("jsonwebtoken");
const redis = require("./config/redisClient");
const crypto = require("crypto");

const PORT = process.env.PORT;
const app = express();

connectDB();
// connectRedis();

app.use(express.json());
app.use(
  cors({
    origin: [
      "https://todo-next-frontend-gamma.vercel.app",
      "http://localhost:3000",
    ],
    allowedHeaders: ["Content-Type", "Authorization", "X-Session-Marker"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(cookieParser());

// === Login / Logout endpoints ===
app.post("/login", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: "Token missing" });

  try {
    // Verify the Firebase token
    const decoded = await admin.auth().verifyIdToken(token);
    console.log(decoded);

    // const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Using JWT to sign a token
    const customJwt = jwt.sign(
      { uid: decoded.uid, email: decoded.email },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    //  Generate session marker
    const sessionId = crypto.randomUUID();
    await Session.create({ userId: decoded.uid, sessionId });

    //  Return both to frontend
    return res.status(200).json({
      message: "✅ Cookie created successfully",
      jwt: customJwt,
      session_marker: sessionId,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(401)
      .json({ message: "Invalid Firebase token", error: err.message });
  }
});

// On Logout: clear cookie only
app.post("/logout", async (req, res) => {
  const { session_marker } = req.body;
  const deletedSession = await Session.deleteOne({ sessionId: session_marker });
  return res.status(200).json({
    deletedSession: deletedSession,
    message: "✅ Logged out and session cleared",
  });
});

// === CRUD endpoints ===
app.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const cacheKey = `todos_${userId}`;
  console.log("Get req received", userId);

  try {
    // Checking if cache exists
    const cached = await redis.get(cacheKey);
    if (cached) {
      const todos = typeof cached === "string" ? JSON.parse(cached) : cached;
      console.log("✅ Todos form redis cache");

      return res.status(200).json(todos);
    }

    //  Calling DB if cache does not exist
    const todos = await Todo.find({ userId });
    await redis.set(cacheKey, JSON.stringify(todos), { EX: 300 }); // 300s = 5min cache

    return res.status(200).json(todos);
  } catch (error) {
    console.log("Eroor getting todos", error);
    return res.status(500).json({ message: "Error getting todo" });
  }
});

app.post("/", authMiddleware, async (req, res) => {
  const { todo } = req.body;
  if (!todo) {
    return res.status(400).json({ message: "Missing todo or id" });
  }
  const userId = req.user.uid;
  const cacheKey = `todos_${userId}`;

  try {
    const newTodo = new Todo({ todo, userId });
    await newTodo.save();

    // Invalidate Redis cache
    await redis.del(cacheKey);
    // fetch updated todos and set to cache
    const todos = await Todo.find({ userId });
    await redis.set(cacheKey, JSON.stringify(todos), { EX: 300 });
    return res.status(201).json({
      message: "✅ Todo added successfully",
      todos,
    });
  } catch (error) {
    console.log("Error savin todo", error);
    return res.status(500).json({ message: "Error saving todo" });
  }
});

app.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const cacheKey = `todos_${userId}`;

    const deletedTodo = await Todo.findOneAndDelete({ _id: id, userId });
    if (!deletedTodo) {
      res.status(404).json({ message: "❌ Todo not found" });
    }
    // Invalidate Redis cache
    await redis.del(cacheKey);

    // send back updated todo and reset cache
    const todos = await Todo.find({ userId });
    await redis.set(cacheKey, JSON.stringify(todos), { EX: 300 });
    return res.status(200).json({
      message: "✅ Todo deleted successfully",
      todos,
    });
  } catch (error) {
    console.log("Error deleting todo", error);
    return res.status(500).json({ message: "Error deleting todo" });
  }
});

app.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { todo } = req.body;
    const userId = req.user.uid;
    const cacheKey = `todos_${userId}`;

    const updatedTodo = await Todo.findOneAndUpdate(
      { _id: id, userId },
      { todo: todo },
      { new: true } // return updated document
    );

    if (!updatedTodo) {
      res.status(404).json({ message: "❌ Todo not found" });
    }
    // Invalidate Redis cache
    await redis.del(cacheKey);

    // send back updated todo and reset cache
    const todos = await Todo.find({ userId });
    await redis.set(cacheKey, JSON.stringify(todos), { EX: 300 });
    return res.status(200).json({
      message: "✅ Todo updated successfully",
      todos,
    });
  } catch (error) {
    console.log("Error updating todo", error);
    return res.status(500).json({ message: "Error updating todo" });
  }
});

app.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const { completed } = req.body;
    const cacheKey = `todos_${userId}`;

    const updatedTodo = await Todo.findOneAndUpdate(
      { _id: id, userId },
      { completed: completed },
      { new: true } // return updated document
    );

    if (!updatedTodo) {
      res.status(404).json({ message: "❌ Todo not found" });
    }
    // Invalidate Redis cache
    await redis.del(cacheKey);

    // send back updated todo and reset cache
    const todos = await Todo.find({ userId });
    await redis.set(cacheKey, JSON.stringify(todos), { EX: 300 });
    return res.status(200).json({
      message: "✅ Complete status updated successfully",
      todos,
    });
  } catch (error) {
    console.log("Error in complete-status update", error);
    return res.status(500).json({ message: "Error in complete-status update" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is runnig on http://localhost:${PORT}`);
});
