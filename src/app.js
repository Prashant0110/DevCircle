require("dotenv").config();

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");

// Import routes - MAKE SURE THE PATH IS CORRECT
const codeDocumentRoutes = require("./Routes/codeDocumentRoutes"); // Check this path
const authRoutes = require("./Routes/authRoutes");
const chatRoutes = require("./Routes/chatRoutes");
const connectionRoutes = require("./Routes/connectionRoutes");
const profileRoutes = require("./Routes/profileRoutes");

const { authorizeLiveblocksUser } = require("./middleware/liveBlockAuth");
const Message = require("./models/Message");
const Conversation = require("./models/Conversation");
const User = require("./models/UserModel");
const auth = require("./middleware/auth");

const app = express();
const server = http.createServer(app);

// Configure CORS
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:3001"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Configure Socket.IO with CORS
const io = socketIo(server, {
  cors: corsOptions,
});

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes - MAKE SURE THESE ARE IN THE RIGHT ORDER
app.use("/auth", authRoutes);
app.use("/chat", chatRoutes);
app.use("/api/connection", connectionRoutes);
app.use("/api/user", profileRoutes);
app.use("/api/code-documents", codeDocumentRoutes); // THIS IS THE IMPORTANT ONE

// Liveblocks auth endpoint
app.post("/api/liveblocks-auth", auth, authorizeLiveblocksUser);

// Test route to verify server is working
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Server is working",
    timestamp: new Date().toISOString(),
    routes: {
      auth: "/auth/*",
      chat: "/chat/*",
      connections: "/api/connection/*",
      profiles: "/api/user/*",
      codeDocuments: "/api/code-documents/*",
    },
  });
});

// Socket.IO connection handling (your existing socket code here)
// ... your socket code ...

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    ...(process.env.NODE_ENV === "development" && { error: err.message }),
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method,
    availableRoutes: [
      "/auth/*",
      "/chat/*",
      "/api/connection/*",
      "/api/user/*",
      "/api/code-documents/*",
    ],
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Available routes:");
  console.log("  - Auth: /auth/*");
  console.log("  - Chat: /chat/*");
  console.log("  - Connections: /api/connection/*");
  console.log("  - Profiles: /api/user/*");
  console.log("  - Code Documents: /api/code-documents/*");
});

module.exports = { app, server, io };
