const express = require("express");
const router = express.Router();
const CodeDocument = require("../models/CodeDocument");
const auth = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

// Get all code documents for a user
router.get("/", auth, async (req, res) => {
  try {
    const documents = await CodeDocument.find({
      $or: [
        { createdBy: req.user._id },
        { "sharedWith.user": req.user._id },
        { isPublic: true },
      ],
    })
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get a specific code document by roomId
router.get("/room/:roomId", auth, async (req, res) => {
  try {
    const document = await CodeDocument.findOne({
      roomId: req.params.roomId,
    })
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email");

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Check if user has access
    if (!document.hasAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Error fetching document by roomId:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get a specific code document by id
router.get("/:id", auth, async (req, res) => {
  try {
    const document = await CodeDocument.findById(req.params.id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email");

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Check if user has access
    if (!document.hasAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Create a new code document
router.post("/", auth, async (req, res) => {
  try {
    const { title, language, isPublic } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    // Generate a unique room ID
    const roomId = uuidv4();

    const document = new CodeDocument({
      title: title.trim(),
      language: language || "javascript",
      createdBy: req.user._id,
      isPublic: isPublic || false,
      roomId,
      content: `// ${title}\n// Created by ${req.user.firstName} ${req.user.lastName}\n\n`,
    });

    await document.save();
    await document.populate("createdBy", "firstName lastName email");

    res.status(201).json({
      success: true,
      data: document,
      message: "Document created successfully",
    });
  } catch (error) {
    console.error("Error creating document:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Update a code document
router.put("/:id", auth, async (req, res) => {
  try {
    const { title, content, language, isPublic, sharedWith } = req.body;

    const document = await CodeDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Check if user can edit
    if (!document.canEdit(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Edit access denied",
      });
    }

    if (title !== undefined) document.title = title;
    if (content !== undefined) document.content = content;
    if (language !== undefined) document.language = language;
    if (isPublic !== undefined) document.isPublic = isPublic;
    if (sharedWith !== undefined) document.sharedWith = sharedWith;

    await document.save();

    // Populate after save
    const updatedDoc = await CodeDocument.findById(document._id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email");

    res.json({
      success: true,
      data: updatedDoc,
      message: "Document updated successfully",
    });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Delete a code document
router.delete("/:id", auth, async (req, res) => {
  try {
    const document = await CodeDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Check if user is the owner
    if (document.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Delete access denied",
      });
    }

    await CodeDocument.deleteOne({ _id: req.params.id });

    res.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Share a code document with another user
router.post("/:id/share", auth, async (req, res) => {
  try {
    const { userId, permission } = req.body;

    const document = await CodeDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Check if user is the owner
    if (document.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Share access denied",
      });
    }

    // Check if user is already shared with
    const existingShare = document.sharedWith.find(
      (share) => share.user.toString() === userId
    );

    if (existingShare) {
      existingShare.permission = permission;
    } else {
      document.sharedWith.push({ user: userId, permission });
    }

    await document.save();

    const updatedDoc = await CodeDocument.findById(document._id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email");

    res.json({
      success: true,
      data: updatedDoc,
      message: "Document shared successfully",
    });
  } catch (error) {
    console.error("Error sharing document:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
