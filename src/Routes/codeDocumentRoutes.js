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
        { createdBy: req.user.id },
        { "sharedWith.user": req.user.id },
        { isPublic: true },
      ],
    })
      .populate("createdBy", "username avatar")
      .populate("sharedWith.user", "username avatar");

    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a specific code document by roomId
router.get("/room/:roomId", auth, async (req, res) => {
  try {
    const document = await CodeDocument.findOne({
      roomId: req.params.roomId,
    })
      .populate("createdBy", "username avatar")
      .populate("sharedWith.user", "username avatar");

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if user has access
    if (!document.hasAccess(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a specific code document by id
router.get("/:id", auth, async (req, res) => {
  try {
    const document = await CodeDocument.findById(req.params.id)
      .populate("createdBy", "username avatar")
      .populate("sharedWith.user", "username avatar");

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if user has access
    if (!document.hasAccess(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new code document
router.post("/", auth, async (req, res) => {
  try {
    const { title, language, isPublic } = req.body;

    // Generate a unique room ID
    const roomId = uuidv4();

    const document = new CodeDocument({
      title,
      language: language || "javascript",
      createdBy: req.user.id,
      isPublic: isPublic || false,
      roomId,
    });

    await document.save();
    await document.populate("createdBy", "username avatar");

    res.status(201).json(document);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a code document
router.put("/:id", auth, async (req, res) => {
  try {
    const { title, content, language, isPublic, sharedWith } = req.body;

    const document = await CodeDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if user can edit
    if (!document.canEdit(req.user.id)) {
      return res.status(403).json({ message: "Edit access denied" });
    }

    if (title !== undefined) document.title = title;
    if (content !== undefined) document.content = content;
    if (language !== undefined) document.language = language;
    if (isPublic !== undefined) document.isPublic = isPublic;
    if (sharedWith !== undefined) document.sharedWith = sharedWith;

    await document.save();
    await document
      .populate("createdBy", "username avatar")
      .populate("sharedWith.user", "username avatar");

    res.json(document);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a code document
router.delete("/:id", auth, async (req, res) => {
  try {
    const document = await CodeDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if user is the owner
    if (document.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Delete access denied" });
    }

    await CodeDocument.deleteOne({ _id: req.params.id });
    res.json({ message: "Document deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Share a code document with another user
router.post("/:id/share", auth, async (req, res) => {
  try {
    const { userId, permission } = req.body;

    const document = await CodeDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if user is the owner
    if (document.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Share access denied" });
    }

    // Check if user is already shared with
    const existingShare = document.sharedWith.find(
      (share) => share.user.toString() === userId
    );

    if (existingShare) {
      // Update existing share
      existingShare.permission = permission;
    } else {
      // Add new share
      document.sharedWith.push({ user: userId, permission });
    }

    await document.save();
    await document.populate("sharedWith.user", "username avatar");

    res.json(document);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
