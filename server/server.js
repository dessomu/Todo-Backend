require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const Todo = require("./models/todo");
const authMiddleware = require("./middlewares/authMiddleware");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const admin = require("./config/firebaseAdmin");
const jwt = require("jsonwebtoken");
const redis = require("./config/redisClient");

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
    credentials: true,
  })
);
app.use(cookieParser());

// === Login / Logout endpoints ===
app.post("/login", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: "Token missing" });
  console.log(token);

  try {
    // Verify the Firebase token
    const decoded = await admin.auth().verifyIdToken(token);
    console.log(decoded);

    const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Using JWT to sign a token
    const customJwt = jwt.sign(
      { uid: decoded.uid, email: decoded.email },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );
    console.log(customJwt);

    // Setting the JWT in cookie
    res.cookie("auth_token", customJwt, {
      httpOnly: true,
      secure: true, // true in production
      sameSite: "none",
      maxAge: expiresIn,
      path: "/",
    });

    res
      .status(200)
      .json({ message: "✅ Cookie created successfully", success: true });
  } catch (err) {
    console.error(err);
    res
      .status(401)
      .json({ message: "Invalid Firebase token", error: err.message });
  }
});

// On Logout: clear cookie only
app.post("/logout", (req, res) => {
  console.log("logout request received");

  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: true, // true in production
    sameSite: "none",
    path: "/",
  });
  return res
    .status(200)
    .json({ success: true, message: "✅ Logged out and cookie cleared" });
});

// === CRUD endpoints ===
app.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const cacheKey = `todos_${userId}`;
  console.log("get request received", userId);

  // Checking if cache exists
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log("✅ Todos from Redis cache");
    // Handle both string and object cases safely
    const todos = typeof cached === "string" ? JSON.parse(cached) : cached;

    return res.json(todos);
  }

  //  Calling DB if cache does not exist
  const todos = await Todo.find({ userId });
  await redis.set(cacheKey, JSON.stringify(todos), { EX: 300 }); // 300s = 5min cache
  console.log("💾 Todos saved in Redis cache");

  res.json(todos);
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
    res.status(201).json({
      message: "✅ Todo added successfully",
      todos,
    });
  } catch (error) {
    console.log("Error savin todo", error);
    res.status(500).json({ message: "Error saving todo" });
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
    res.status(201).json({
      message: "✅ Todo deleted successfully",
      todos,
    });
  } catch (error) {
    console.log("Error deleting todo", error);
    res.status(500).json({ message: "Error deleting todo" });
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
    res.status(201).json({
      message: "✅ Todo updated successfully",
      todos,
    });
  } catch (error) {
    console.log("Error updating todo", error);
    res.status(500).json({ message: "Error updating todo" });
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
    res.status(201).json({
      message: "✅ Complete status updated successfully",
      todos,
    });
  } catch (error) {
    console.log("Error in complete-status update", error);
    res.status(500).json({ message: "Error in complete-status update" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is runnig on http://localhost:${PORT}`);
});
