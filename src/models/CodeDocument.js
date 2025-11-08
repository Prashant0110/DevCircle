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
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastModifiedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Method to check if user has access to document
codeDocumentSchema.methods.hasAccess = function (userId) {
  const userIdStr = userId ? userId.toString() : "";

  let creatorIdStr = "";
  if (this.createdBy) {
    if (this.createdBy._id) {
      creatorIdStr = this.createdBy._id.toString();
    } else {
      creatorIdStr = this.createdBy.toString();
    }
  }

  if (this.isPublic) return true;
  if (creatorIdStr === userIdStr) return true;

  const hasSharedAccess = this.sharedWith.some((share) => {
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

  return hasSharedAccess;
};

// Method to check if user can edit document content
codeDocumentSchema.methods.canEdit = function (userId) {
  const userIdStr = userId ? userId.toString() : "";

  let creatorIdStr = "";
  if (this.createdBy) {
    if (this.createdBy._id) {
      creatorIdStr = this.createdBy._id.toString();
    } else {
      creatorIdStr = this.createdBy.toString();
    }
  }

  if (creatorIdStr === userIdStr) return true;

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

// Method to check if user can manage sharing (only owner)
codeDocumentSchema.methods.canShare = function (userId) {
  const userIdStr = userId ? userId.toString() : "";

  let creatorIdStr = "";
  if (this.createdBy) {
    if (this.createdBy._id) {
      creatorIdStr = this.createdBy._id.toString();
    } else {
      creatorIdStr = this.createdBy.toString();
    }
  }

  return creatorIdStr === userIdStr;
};

// Method to get user's permission level
codeDocumentSchema.methods.getUserPermission = function (userId) {
  const userIdStr = userId ? userId.toString() : "";

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

// IMPORTANT: Make sure this export is correct
module.exports = mongoose.model("CodeDocument", codeDocumentSchema);
