const express = require("express");
const chatRoutes = express.Router();
const auth = require("../middleware/auth");

const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/UserModel");

// Create or get existing conversation
chatRoutes.post("/conversations", auth, async (req, res) => {
  try {
    const { participantId } = req.body;
    const userId = req.user._id;

    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: "Participant ID is required",
      });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, participantId] },
    });

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        participants: [userId, participantId],
      });
      await conversation.save();
    }

    await conversation.populate("participants", "firstName lastName email");

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("Error creating/fetching conversation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create/fetch conversation",
    });
  }
});

// Get all conversations for a user
chatRoutes.get("/conversations/list", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "firstName lastName email")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "firstName lastName" },
      })
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: conversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversations",
    });
  }
});

// Get messages for a conversation
chatRoutes.get(
  "/conversations/:conversationId/messages",
  auth,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.user._id;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      const messages = await Message.find({ conversation: conversationId })
        .populate("sender", "firstName lastName")
        .sort({ createdAt: 1 });

      // Mark messages as read
      await Message.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        },
        { $addToSet: { readBy: userId } }
      );

      res.json({ success: true, data: messages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch messages",
      });
    }
  }
);

// Send a message
chatRoutes.post(
  "/conversations/:conversationId/messages",
  auth,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;
      const userId = req.user._id;

      if (!content || !content.trim()) {
        return res.status(400).json({
          success: false,
          message: "Message content is required",
        });
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      const message = new Message({
        conversation: conversationId,
        sender: userId,
        content: content.trim(),
        readBy: [userId],
      });

      await message.save();

      conversation.lastMessage = message._id;
      conversation.updatedAt = new Date();
      await conversation.save();

      await message.populate("sender", "firstName lastName");

      res.status(201).json({ success: true, data: message });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send message",
      });
    }
  }
);

// Mark messages as read
chatRoutes.patch(
  "/conversations/:conversationId/read",
  auth,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.user._id;

      // Verify user is part of conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      // Mark messages as read
      const result = await Message.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        },
        { $addToSet: { readBy: userId } }
      );

      res.json({
        success: true,
        message: "Messages marked as read",
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark messages as read",
      });
    }
  }
);

module.exports = chatRoutes;
