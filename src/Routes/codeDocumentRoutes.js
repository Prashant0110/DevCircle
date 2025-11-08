const express = require("express");
const router = express.Router();
const CodeDocument = require("../models/CodeDocument");
const ConnectionRequest = require("../models/ConnectionModel");
const User = require("../models/UserModel");
const auth = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

// Debug middleware to log all requests to this router
router.use((req, res, next) => {
  console.log(`Code Documents Route: ${req.method} ${req.path}`);
  console.log("Full URL:", req.originalUrl);
  console.log("Params:", req.params);
  console.log("Body:", req.body);
  next();
});

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

// Share a code document with another user - MOVED UP to avoid conflicts
router.post("/:id/share", auth, async (req, res) => {
  try {
    const { userId, permission } = req.body;
    const documentId = req.params.id;

    console.log("=== SHARE REQUEST DEBUG ===");
    console.log("Document ID from params:", documentId);
    console.log("Current user ID:", req.user._id);
    console.log("Target user ID:", userId);
    console.log("Permission:", permission);
    console.log("Route matched: /:id/share");

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

    // Check if user can edit
    const userIdStr = req.user._id.toString();
    const creatorIdStr = document.createdBy.toString();

    let canEdit = false;
    if (creatorIdStr === userIdStr) {
      canEdit = true;
      console.log("User is document creator - can edit");
    } else {
      const shareFound = document.sharedWith.find(
        (share) =>
          share.user.toString() === userIdStr && share.permission === "edit"
      );
      canEdit = !!shareFound;
      console.log("User edit permission check:", canEdit);
    }

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: "Share access denied - you need edit permission",
      });
    }

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
      .populate("sharedWith.user", "firstName lastName email");

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

// Remove share access
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

    // Check if user is the owner
    if (document.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the owner can remove share access",
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
      .populate("sharedWith.user", "firstName lastName email");

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

// Get a specific code document by roomId
router.get("/room/:roomId", auth, async (req, res) => {
  try {
    console.log("=== DEBUG: Fetching document ===");
    console.log("RoomId:", req.params.roomId);
    console.log("User ID from token:", req.user._id);

    const document = await CodeDocument.findOne({
      roomId: req.params.roomId,
    })
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email");

    if (!document) {
      console.log("Document not found for roomId:", req.params.roomId);
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    console.log("Document found:", document.title);

    // Manual access check with proper ID comparison
    const userIdStr = req.user._id.toString();
    const creatorIdStr = document.createdBy._id.toString();

    let hasAccess = false;
    let userPermission = "view";

    // Check if user is creator
    if (creatorIdStr === userIdStr) {
      console.log("User is creator - access granted");
      hasAccess = true;
      userPermission = "owner";
    }
    // Check if document is public
    else if (document.isPublic) {
      console.log("Document is public - access granted");
      hasAccess = true;
      userPermission = "view";
    }
    // Check shared access
    else {
      const shareFound = document.sharedWith.find(
        (share) => share.user._id.toString() === userIdStr
      );
      if (shareFound) {
        console.log("User has shared access - access granted");
        hasAccess = true;
        userPermission = shareFound.permission;
      }
    }

    if (!hasAccess) {
      console.log("=== ACCESS DENIED ===");
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    console.log("Access granted, permission:", userPermission);

    // Determine if user can edit
    const canEdit = userPermission === "owner" || userPermission === "edit";

    res.json({
      success: true,
      data: {
        ...document.toObject(),
        userPermission,
        canEdit,
      },
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
    console.log("=== GET DOCUMENT BY ID ===");
    console.log("Document ID:", req.params.id);

    const document = await CodeDocument.findById(req.params.id)
      .populate("createdBy", "firstName lastName email")
      .populate("sharedWith.user", "firstName lastName email");

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

    res.json({
      success: true,
      data: {
        ...document.toObject(),
        userPermission,
        canEdit,
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

// Get matched users for sharing
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
    const userIdStr = req.user._id.toString();
    const creatorIdStr = document.createdBy.toString(); // Not populated here

    let canEdit = false;
    if (creatorIdStr === userIdStr) {
      canEdit = true;
    } else {
      const shareFound = document.sharedWith.find(
        (share) =>
          share.user.toString() === userIdStr && share.permission === "edit"
      );
      canEdit = !!shareFound;
    }

    if (!canEdit) {
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

// Debug route to test if routes are working
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Code documents routes are working",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
