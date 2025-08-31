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
  if (this.isPublic) return true;
  if (this.createdBy.toString() === userId.toString()) return true;
  return this.sharedWith.some(
    (share) => share.user.toString() === userId.toString()
  );
};

// Method to check if user can edit document
codeDocumentSchema.methods.canEdit = function (userId) {
  if (this.createdBy.toString() === userId.toString()) return true;
  const share = this.sharedWith.find(
    (share) => share.user.toString() === userId.toString()
  );
  return share && share.permission === "edit";
};

module.exports = mongoose.model("CodeDocument", codeDocumentSchema);
