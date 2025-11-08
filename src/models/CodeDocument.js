const mongoose = require("mongoose");

const codeDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      default: "",
    },
    language: {
      type: String,
      default: "javascript",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sharedWith: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        permission: {
          type: String,
          enum: ["view", "edit"],
          default: "view",
        },
        sharedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isPublic: {
      type: Boolean,
      default: false,
    },
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

// Method to check if user has access to document
codeDocumentSchema.methods.hasAccess = function (userId) {
  console.log("=== hasAccess method ===");
  console.log("Input userId:", userId, "Type:", typeof userId);
  console.log(
    "Document createdBy:",
    this.createdBy,
    "Type:",
    typeof this.createdBy
  );
  console.log("Document isPublic:", this.isPublic);

  // Convert userId to string
  const userIdStr = userId ? userId.toString() : "";

  // Handle createdBy - it might be populated or just an ObjectId
  let creatorIdStr = "";
  if (this.createdBy) {
    if (this.createdBy._id) {
      // createdBy is populated
      creatorIdStr = this.createdBy._id.toString();
    } else {
      // createdBy is just an ObjectId
      creatorIdStr = this.createdBy.toString();
    }
  }

  console.log("UserID (string):", userIdStr);
  console.log("CreatorID (string):", creatorIdStr);

  // Check if document is public
  if (this.isPublic) {
    console.log("Document is public, access granted");
    return true;
  }

  // Check if user is creator
  if (creatorIdStr === userIdStr) {
    console.log("User is creator, access granted");
    return true;
  }

  // Check shared access
  console.log("Checking shared access...");
  console.log("SharedWith array:", this.sharedWith);

  const hasSharedAccess = this.sharedWith.some((share) => {
    let shareUserIdStr = "";
    if (share.user) {
      if (share.user._id) {
        // user is populated
        shareUserIdStr = share.user._id.toString();
      } else {
        // user is just an ObjectId
        shareUserIdStr = share.user.toString();
      }
    }
    console.log(
      `Comparing share user ${shareUserIdStr} with user ${userIdStr}`
    );
    return shareUserIdStr === userIdStr;
  });

  console.log("Shared access result:", hasSharedAccess);
  return hasSharedAccess;
};

// Method to check if user can edit document
codeDocumentSchema.methods.canEdit = function (userId) {
  const userIdStr = userId ? userId.toString() : "";

  // Handle createdBy - it might be populated or just an ObjectId
  let creatorIdStr = "";
  if (this.createdBy) {
    if (this.createdBy._id) {
      creatorIdStr = this.createdBy._id.toString();
    } else {
      creatorIdStr = this.createdBy.toString();
    }
  }

  // Creator can always edit
  if (creatorIdStr === userIdStr) return true;

  // Check if user has edit permission
  const share = this.sharedWith.find((share) => {
    let shareUserIdStr = "";
    if (share.user) {
      if (share.user._id) {
        shareUserIdStr = share.user._id.toString();
      } else {
        shareUserIdStr = share.user.toString();
      }
    }
    return shareUserIdStr === userIdStr;
  });

  return share && share.permission === "edit";
};

// Method to get user's permission level
codeDocumentSchema.methods.getUserPermission = function (userId) {
  const userIdStr = userId ? userId.toString() : "";

  // Handle createdBy - it might be populated or just an ObjectId
  let creatorIdStr = "";
  if (this.createdBy) {
    if (this.createdBy._id) {
      creatorIdStr = this.createdBy._id.toString();
    } else {
      creatorIdStr = this.createdBy.toString();
    }
  }

  if (creatorIdStr === userIdStr) return "owner";

  const share = this.sharedWith.find((share) => {
    let shareUserIdStr = "";
    if (share.user) {
      if (share.user._id) {
        shareUserIdStr = share.user._id.toString();
      } else {
        shareUserIdStr = share.user.toString();
      }
    }
    return shareUserIdStr === userIdStr;
  });

  return share ? share.permission : null;
};

module.exports = mongoose.model("CodeDocument", codeDocumentSchema);
