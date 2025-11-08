// Routes/codeDocumentRoutes.js
const express = require("express");
const router = express.Router();
const CodeDocument = require("../models/CodeDocument");
const auth = require("../middleware/auth");
const User = require("../models/UserModel");

// ===============================================
// 📁 1. CREATE A NEW DOCUMENT
// ===============================================
router.post("/", auth, async (req, res) => {
  try {
    const { title, language, content } = req.body;

    const document = new CodeDocument({
      title,
      language,
      content,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id,
    });

    await document.save();
    const populatedDoc = await CodeDocument.findById(document._id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email");

    res.status(201).json({ success: true, data: populatedDoc });
  } catch (error) {
    console.error("Error creating document:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===============================================
// 📂 2. GET ALL DOCUMENTS (OWNED OR SHARED)
// ===============================================
router.get("/", auth, async (req, res) => {
  try {
    const docs = await CodeDocument.find({
      $or: [{ createdBy: req.user._id }, { "sharedWith.user": req.user._id }],
    })
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: docs });
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===============================================
// 📄 3. GET SINGLE DOCUMENT BY ID
// ===============================================
router.get("/:id", auth, async (req, res) => {
  try {
    const doc = await CodeDocument.findById(req.params.id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email");

    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });

    // Check access rights
    const isOwner = doc.createdBy._id.toString() === req.user._id.toString();
    const isShared = doc.sharedWith.some(
      (share) => share.user._id.toString() === req.user._id.toString()
    );

    if (!isOwner && !isShared) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this document",
      });
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===============================================
// ✏️ 4. UPDATE DOCUMENT CONTENT
// ===============================================
router.put("/:id", auth, async (req, res) => {
  try {
    const { title, content, language } = req.body;
    const doc = await CodeDocument.findById(req.params.id);

    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });

    const isOwner = doc.createdBy.toString() === req.user._id.toString();
    const isShared = doc.sharedWith.some(
      (share) => share.user.toString() === req.user._id.toString()
    );

    if (!isOwner && !isShared) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this document",
      });
    }

    doc.title = title ?? doc.title;
    doc.content = content ?? doc.content;
    doc.language = language ?? doc.language;
    doc.lastModifiedBy = req.user._id;
    await doc.save();

    const updatedDoc = await CodeDocument.findById(doc._id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email");

    res.json({ success: true, data: updatedDoc });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===============================================
// 🗑️ 5. DELETE DOCUMENT (ONLY OWNER)
// ===============================================
router.delete("/:id", auth, async (req, res) => {
  try {
    const doc = await CodeDocument.findById(req.params.id);

    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });

    if (doc.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the document owner can delete it",
      });
    }

    await doc.deleteOne();
    res.json({ success: true, message: "Document deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===============================================
// 🤝 6. SHARE DOCUMENT ACCESS (OWNER ONLY)
// ===============================================
router.post("/:id/share", auth, async (req, res) => {
  try {
    const { userId, permission } = req.body;
    const doc = await CodeDocument.findById(req.params.id);

    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });

    if (doc.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the owner can share this document",
      });
    }

    const alreadyShared = doc.sharedWith.some(
      (share) => share.user.toString() === userId
    );
    if (alreadyShared) {
      return res.status(400).json({
        success: false,
        message: "User is already shared with this document",
      });
    }

    doc.sharedWith.push({ user: userId, permission });
    await doc.save();

    const updatedDoc = await CodeDocument.findById(doc._id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email");

    res.json({
      success: true,
      data: updatedDoc,
      message: "Document shared successfully",
    });
  } catch (error) {
    console.error("Error sharing document:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===============================================
// 🚫 7. REMOVE USER SHARE ACCESS (OWNER ONLY)
// ===============================================
router.delete("/:id/share/:userId", auth, async (req, res) => {
  try {
    const { id, userId } = req.params;
    const doc = await CodeDocument.findById(id);

    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });

    if (doc.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the document owner can remove share access",
      });
    }

    const originalLength = doc.sharedWith.length;
    doc.sharedWith = doc.sharedWith.filter(
      (share) => share.user.toString() !== userId
    );

    if (doc.sharedWith.length === originalLength) {
      return res.status(404).json({
        success: false,
        message: "User was not shared with this document",
      });
    }

    await doc.save();

    const updatedDoc = await CodeDocument.findById(doc._id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email");

    res.json({
      success: true,
      data: updatedDoc,
      message: "Share access removed successfully",
    });
  } catch (error) {
    console.error("Error removing share access:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===============================================
// 🔗 8. GET DOCUMENTS BY ROOM ID (LIVEBLOCKS)
// ===============================================
router.get("/room/:roomId", auth, async (req, res) => {
  try {
    const doc = await CodeDocument.findOne({ roomId: req.params.roomId })
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email");

    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error("Error fetching document by room ID:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
