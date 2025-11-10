const express = require("express");
const router = express.Router();
const CodeDocument = require("../models/CodeDocument");
const ConnectionRequest = require("../models/ConnectionModel");
const User = require("../models/UserModel");
const auth = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

// Debug middleware
router.use((req, res, next) => {
  console.log(`Code Documents Route: ${req.method} ${req.path}`);
  console.log("User:", req.user ? req.user._id : "No user");
  next();
});

// ===============================================
// 📂 1. GET ALL DOCUMENTS (OWNED OR SHARED)
// ===============================================
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
      .populate("lastModifiedBy", "firstName lastName email")
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

// ===============================================
// 🧪 2. TEST ROUTE - MOVED TO TOP
// ===============================================
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Code documents routes are working",
    timestamp: new Date().toISOString(),
  });
});

// ===============================================
// 🔗 3. GET DOCUMENTS BY ROOM ID (LIVEBLOCKS)
// ===============================================
router.get("/room/:roomId", auth, async (req, res) => {
  try {
    console.log("=== DEBUG: Fetching document ===");
    console.log("RoomId:", req.params.roomId);
    console.log("User ID from token:", req.user._id);

    const document = await CodeDocument.findOne({
      roomId: req.params.roomId,
    })
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email");

    if (!document) {
      console.log("Document not found for roomId:", req.params.roomId);
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    console.log("Document found:", document.title);
    console.log("Document content length:", document.content?.length || 0);
    console.log(
      "Document content preview:",
      document.content?.substring(0, 100) + "..."
    );

    const userIdStr = req.user._id.toString();
    const creatorIdStr = document.createdBy._id.toString();

    let hasAccess = false;
    let userPermission = "view";

    // FIXED: Check if user is the owner first (highest priority)
    const isOwner = creatorIdStr === userIdStr;

    if (isOwner) {
      console.log("User is document owner - full access granted");
      hasAccess = true;
      userPermission = "owner";
    }
    // Check if document is public
    else if (document.isPublic) {
      console.log("Document is public - view access granted");
      hasAccess = true;
      userPermission = "view";
    }
    // Check shared access
    else {
      const shareFound = document.sharedWith.find(
        (share) => share.user._id.toString() === userIdStr
      );
      if (shareFound) {
        console.log(
          `User has shared access (${shareFound.permission}) - access granted`
        );
        hasAccess = true;
        userPermission = shareFound.permission;
      }
    }

    if (!hasAccess) {
      console.log("=== ACCESS DENIED ===");
      console.log("User ID:", userIdStr);
      console.log("Creator ID:", creatorIdStr);
      console.log("Is Public:", document.isPublic);
      console.log(
        "Shared With:",
        document.sharedWith.map((s) => s.user._id.toString())
      );
      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this document",
      });
    }

    console.log("=== ACCESS GRANTED ===");
    console.log("User permission:", userPermission);
    console.log("Is owner:", isOwner);

    // FIXED: Owner always has full permissions regardless of sharing settings
    const canEdit = isOwner || userPermission === "edit";
    const canShare = isOwner; // ONLY OWNER CAN SHARE
    const canDelete = isOwner; // ONLY OWNER CAN DELETE

    console.log("Final permissions:");
    console.log("- canEdit:", canEdit);
    console.log("- canShare:", canShare);
    console.log("- canDelete:", canDelete);

    // IMPORTANT: Make sure we return the actual content from database
    const responseData = {
      ...document.toObject(),
      userPermission,
      canEdit,
      canShare,
      canDelete,
    };

    console.log("=== SENDING RESPONSE ===");
    console.log("Response content length:", responseData.content?.length || 0);
    console.log(
      "Response content preview:",
      responseData.content?.substring(0, 100) + "..."
    );

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching document by roomId:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===============================================
// 👥 4. GET MATCHED USERS FOR SHARING
// ===============================================
router.get("/matched-users", auth, async (req, res) => {
  try {
    console.log("=== FETCHING MATCHED USERS ===");
    console.log("Current user ID:", req.user._id);

    const connections = await ConnectionRequest.find({
      $or: [
        { fromReqId: req.user._id, status: "accepted" },
        { toReqId: req.user._id, status: "accepted" },
      ],
    })
      .populate("fromReqId", "firstName lastName email")
      .populate("toReqId", "firstName lastName email");

    console.log("Found connections:", connections.length);

    const matchedUsers = connections.map((connection) => {
      const otherUser =
        connection.fromReqId._id.toString() === req.user._id.toString()
          ? connection.toReqId
          : connection.fromReqId;

      console.log("Matched user:", otherUser.firstName, otherUser.lastName);
      return otherUser;
    });

    res.json({
      success: true,
      data: matchedUsers,
    });
  } catch (error) {
    console.error("Error fetching matched users:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===============================================
// 📊 5. GET DOCUMENTS SHARED BY USER
// ===============================================
router.get("/shared-by-me", auth, async (req, res) => {
  try {
    const documents = await CodeDocument.find({
      createdBy: req.user._id,
      "sharedWith.0": { $exists: true }, // Has at least one share
    })
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching shared documents:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===============================================
// 📥 6. GET DOCUMENTS SHARED WITH USER
// ===============================================
router.get("/shared-with-me", auth, async (req, res) => {
  try {
    const documents = await CodeDocument.find({
      "sharedWith.user": req.user._id,
    })
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching shared with me documents:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===============================================
// 📈 7. GET USER'S DOCUMENT STATISTICS
// ===============================================
router.get("/user-stats", auth, async (req, res) => {
  try {
    const [owned, shared, sharedWithMe, publicDocs] = await Promise.all([
      CodeDocument.countDocuments({ createdBy: req.user._id }),
      CodeDocument.countDocuments({
        createdBy: req.user._id,
        "sharedWith.0": { $exists: true },
      }),
      CodeDocument.countDocuments({ "sharedWith.user": req.user._id }),
      CodeDocument.countDocuments({
        createdBy: req.user._id,
        isPublic: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
        owned,
        shared,
        sharedWithMe,
        public: publicDocs,
        total: owned + sharedWithMe,
      },
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===============================================
// 📁 8. CREATE A NEW DOCUMENT
// ===============================================
router.post("/", auth, async (req, res) => {
  try {
    const { title, language, isPublic } = req.body;

    console.log("=== CREATE DOCUMENT ===");
    console.log("Title:", title);
    console.log("Language:", language);
    console.log("User:", req.user.firstName, req.user.lastName);

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
      content: `// ${title}\n// Created by ${req.user.firstName} ${
        req.user.lastName
      }\n// ${new Date().toLocaleDateString()}\n\n`,
      lastModifiedBy: req.user._id,
      lastModifiedAt: new Date(),
    });

    await document.save();
    await document.populate("createdBy", "firstName lastName email");

    console.log("Document created successfully:", document._id);

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

// ===============================================
// ✏️ 9. UPDATE DOCUMENT CONTENT - FIXED
// ===============================================
router.put("/:id", auth, async (req, res) => {
  try {
    const { title, content, language, isPublic, sharedWith } = req.body;

    console.log("=== UPDATE DOCUMENT DEBUG ===");
    console.log("Document ID:", req.params.id);
    console.log("User ID:", req.user._id);
    console.log("User Name:", req.user.firstName, req.user.lastName);
    console.log("Content to save:", content?.substring(0, 100) + "...");
    console.log("Content length:", content?.length || 0);

    const document = await CodeDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const userIdStr = req.user._id.toString();
    const creatorIdStr = document.createdBy.toString();

    // Check user's permission level
    let userPermission = "none";
    let canEditContent = false;
    let canEditSettings = false;

    if (creatorIdStr === userIdStr) {
      userPermission = "owner";
      canEditContent = true;
      canEditSettings = true;
      console.log("User is owner - full edit access");
    } else {
      const shareFound = document.sharedWith.find(
        (share) =>
          share.user.toString() === userIdStr && share.permission === "edit"
      );
      if (shareFound) {
        userPermission = "edit";
        canEditContent = true;
        canEditSettings = false; // Editors can't change settings
        console.log("User has edit permission - content edit only");
      }
    }

    if (!canEditContent) {
      return res.status(403).json({
        success: false,
        message: "Edit access denied",
      });
    }

    // FIXED: Allow content updates for both owner and editors
    if (content !== undefined) {
      console.log("=== UPDATING CONTENT ===");
      console.log("Old content length:", document.content?.length || 0);
      console.log("New content length:", content?.length || 0);

      document.content = content;
      document.lastModifiedBy = req.user._id;
      document.lastModifiedAt = new Date();

      console.log("Content updated successfully");
    }

    // Only owner can update these settings
    if (canEditSettings) {
      if (title !== undefined) {
        document.title = title;
        console.log("Title updated by owner");
      }
      if (language !== undefined) {
        document.language = language;
        console.log("Language updated by owner");
      }
      if (isPublic !== undefined) {
        document.isPublic = isPublic;
        console.log("Public setting updated by owner");
      }
      if (sharedWith !== undefined) {
        document.sharedWith = sharedWith;
        console.log("Shared settings updated by owner");
      }
    } else {
      // If non-owner tries to update settings, ignore but don't error
      if (
        title !== undefined ||
        language !== undefined ||
        isPublic !== undefined ||
        sharedWith !== undefined
      ) {
        console.log("Non-owner attempted to update settings - ignored");
      }
    }

    // IMPORTANT: Save the document
    await document.save();
    console.log("=== DOCUMENT SAVED TO DATABASE ===");

    // Populate after save
    const updatedDoc = await CodeDocument.findById(document._id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email");

    console.log("=== SENDING UPDATE RESPONSE ===");
    console.log("Saved content length:", updatedDoc.content?.length || 0);

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

// ===============================================
// 🤝 10. SHARE DOCUMENT ACCESS (OWNER ONLY)
// ===============================================
router.post("/:id/share", auth, async (req, res) => {
  try {
    const { userId, permission } = req.body;
    const documentId = req.params.id;

    console.log("=== SHARE REQUEST DEBUG ===");
    console.log("Document ID from params:", documentId);
    console.log("Current user ID:", req.user._id);
    console.log("Target user ID:", userId);
    console.log("Permission:", permission);

    if (!userId || !permission) {
      return res.status(400).json({
        success: false,
        message: "User ID and permission are required",
      });
    }

    if (!["view", "edit"].includes(permission)) {
      return res.status(400).json({
        success: false,
        message: "Permission must be 'view' or 'edit'",
      });
    }

    const document = await CodeDocument.findById(documentId);

    if (!document) {
      console.log("Document not found with ID:", documentId);
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    console.log("Document found:", document.title);

    // FIXED: Only document owner can share (not editors)
    const userIdStr = req.user._id.toString();
    const creatorIdStr = document.createdBy.toString();

    if (creatorIdStr !== userIdStr) {
      console.log("Access denied: Only document owner can share");
      return res.status(403).json({
        success: false,
        message: "Only the document owner can share with others",
      });
    }

    console.log("User is document owner - can share");

    // Check if the target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      console.log("Target user not found:", userId);
      return res.status(404).json({
        success: false,
        message: "Target user not found",
      });
    }

    console.log(
      "Target user found:",
      targetUser.firstName,
      targetUser.lastName
    );

    // Check if users are connected
    console.log("Checking connection between users...");

    const acceptedConnection = await ConnectionRequest.findOne({
      $or: [
        { fromReqId: req.user._id, toReqId: userId, status: "accepted" },
        { fromReqId: userId, toReqId: req.user._id, status: "accepted" },
      ],
    });

    console.log(
      "Connection check result:",
      acceptedConnection ? "Connected" : "Not connected"
    );

    if (!acceptedConnection) {
      console.log("No accepted connection found between users");
      return res.status(403).json({
        success: false,
        message: "You can only share with connected users",
      });
    }

    console.log("Connection verified, proceeding with share...");

    // Check if user is already shared with
    const existingShareIndex = document.sharedWith.findIndex(
      (share) => share.user.toString() === userId
    );

    if (existingShareIndex !== -1) {
      // Update existing permission
      console.log("Updating existing share permission");
      document.sharedWith[existingShareIndex].permission = permission;
      document.sharedWith[existingShareIndex].sharedAt = new Date();
    } else {
      // Add new share
      console.log("Adding new share");
      document.sharedWith.push({
        user: userId,
        permission,
        sharedAt: new Date(),
      });
    }

    await document.save();

    const updatedDoc = await CodeDocument.findById(document._id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email");

    console.log("Document shared successfully");

    res.json({
      success: true,
      data: updatedDoc,
      message: "Document shared successfully",
    });
  } catch (error) {
    console.error("Error sharing document:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===============================================
// 🚫 11. REMOVE USER SHARE ACCESS (OWNER ONLY)
// ===============================================
router.delete("/:id/share/:userId", auth, async (req, res) => {
  try {
    const { id: documentId, userId } = req.params;

    console.log("=== REMOVE SHARE DEBUG ===");
    console.log("Document ID:", documentId);
    console.log("User ID to remove:", userId);
    console.log("Current user:", req.user._id);

    const document = await CodeDocument.findById(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // FIXED: Only document owner can remove share access
    if (document.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the document owner can remove share access",
      });
    }

    // Remove the user from sharedWith array
    const originalLength = document.sharedWith.length;
    document.sharedWith = document.sharedWith.filter(
      (share) => share.user.toString() !== userId
    );

    if (document.sharedWith.length === originalLength) {
      return res.status(404).json({
        success: false,
        message: "User was not shared with this document",
      });
    }

    await document.save();

    const updatedDoc = await CodeDocument.findById(document._id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email");

    res.json({
      success: true,
      data: updatedDoc,
      message: "Share access removed successfully",
    });
  } catch (error) {
    console.error("Error removing share access:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===============================================
// 🗑️ 12. DELETE DOCUMENT (ONLY OWNER)
// ===============================================
router.delete("/:id", auth, async (req, res) => {
  try {
    console.log("=== DELETE DOCUMENT ===");
    console.log("Document ID:", req.params.id);
    console.log("User ID:", req.user._id);
    console.log("User Name:", req.user.firstName, req.user.lastName);

    const document = await CodeDocument.findById(req.params.id);

    if (!document) {
      console.log("Document not found");
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    console.log("Document found:", document.title);
    console.log("Document creator:", document.createdBy.toString());
    console.log("Current user:", req.user._id.toString());

    // FIXED: Only document owner can delete
    if (document.createdBy.toString() !== req.user._id.toString()) {
      console.log("Access denied: Only owner can delete");
      return res.status(403).json({
        success: false,
        message: "Only the document owner can delete this document",
      });
    }

    console.log("Permission verified, deleting document...");

    // Use findByIdAndDelete instead of deleteOne for better error handling
    const deletedDoc = await CodeDocument.findByIdAndDelete(req.params.id);

    if (!deletedDoc) {
      throw new Error("Failed to delete document");
    }

    console.log("Document deleted successfully");

    res.json({
      success: true,
      message: "Document deleted successfully",
      data: { deletedId: req.params.id },
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===============================================
// 📄 13. GET SINGLE DOCUMENT BY ID - MOVED TO END
// ===============================================
router.get("/:id", auth, async (req, res) => {
  try {
    console.log("=== GET DOCUMENT BY ID ===");
    console.log("Document ID:", req.params.id);

    const document = await CodeDocument.findById(req.params.id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email");

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Manual access check
    const userIdStr = req.user._id.toString();
    const creatorIdStr = document.createdBy._id.toString();

    let hasAccess = false;
    let userPermission = "view";

    if (creatorIdStr === userIdStr) {
      hasAccess = true;
      userPermission = "owner";
    } else if (document.isPublic) {
      hasAccess = true;
      userPermission = "view";
    } else {
      const shareFound = document.sharedWith.find(
        (share) => share.user._id.toString() === userIdStr
      );
      if (shareFound) {
        hasAccess = true;
        userPermission = shareFound.permission;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const canEdit = userPermission === "owner" || userPermission === "edit";
    const canShare = userPermission === "owner";
    const canDelete = userPermission === "owner";

    res.json({
      success: true,
      data: {
        ...document.toObject(),
        userPermission,
        canEdit,
        canShare,
        canDelete,
      },
    });
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
