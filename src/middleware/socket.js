const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
require("dotenv").config();

// Import models
const Conversation = require("./models/Conversation");
const User = require("./models/User");

// Import routes

const Message = require("../models/Message");

const authRoutes = require("../Routes/authRoutes");
const chatRoutes = require("../Routes/chatRoutes");

const app = express();
const server = http.createServer(app);

// Configure CORS
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:3001"], // Add your frontend URLs
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
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/devcircle")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/user", authRoutes);
app.use("/chat", chatRoutes);

// Socket.IO connection handling
const activeUsers = new Map(); // Store active users and their socket IDs

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle user authentication and join their room
  socket.on("authenticate", async (userId) => {
    try {
      const user = await User.findById(userId);
      if (user) {
        socket.userId = userId;
        activeUsers.set(userId, socket.id);
        socket.join(`user_${userId}`);
        console.log(`User ${userId} authenticated and joined room`);
      }
    } catch (error) {
      console.error("Authentication error:", error);
    }
  });

  // Handle joining a conversation
  socket.on("join_conversation", (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
  });

  // Handle leaving a conversation
  socket.on("leave_conversation", (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
    console.log(`Socket ${socket.id} left conversation ${conversationId}`);
  });

  // Handle sending messages
  socket.on("send_message", async (data) => {
    try {
      const { conversationId, content, sender } = data;

      // Verify sender is authenticated
      if (!socket.userId || socket.userId !== sender) {
        socket.emit("error", "Unauthorized");
        return;
      }

      // Verify user is part of conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: sender,
      });

      if (!conversation) {
        socket.emit("error", "Conversation not found");
        return;
      }

      // Create and save message
      const message = new Message({
        conversation: conversationId,
        sender: sender,
        content: content.trim(),
      });

      await message.save();
      await message.populate("sender", "firstName lastName");

      // Update conversation's last message
      conversation.lastMessage = message._id;
      conversation.updatedAt = new Date();
      await conversation.save();

      // Emit message to all users in the conversation
      io.to(`conversation_${conversationId}`).emit("new_message", message);

      // Send confirmation to sender
      socket.emit("message_sent", message);

      console.log(`Message sent in conversation ${conversationId}`);
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", "Failed to send message");
    }
  });

  // Handle typing indicators
  socket.on("typing_start", (data) => {
    const { conversationId, userId } = data;
    socket.to(`conversation_${conversationId}`).emit("user_typing", {
      userId,
      isTyping: true,
    });
  });

  socket.on("typing_stop", (data) => {
    const { conversationId, userId } = data;
    socket.to(`conversation_${conversationId}`).emit("user_typing", {
      userId,
      isTyping: false,
    });
  });

  // Handle marking messages as read
  socket.on("mark_as_read", async (data) => {
    try {
      const { conversationId, userId } = data;

      // Verify user is authenticated
      if (!socket.userId || socket.userId !== userId) {
        socket.emit("error", "Unauthorized");
        return;
      }

      // Mark messages as read
      await Message.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        },
        {
          $addToSet: { readBy: userId },
        }
      );

      // Notify other users in conversation
      socket.to(`conversation_${conversationId}`).emit("messages_read", {
        conversationId,
        readBy: userId,
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      console.log(`User ${socket.userId} disconnected`);
    }
    console.log("Socket disconnected:", socket.id);
  });
});

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
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO server ready for connections`);
});

module.exports = { app, server, io };
