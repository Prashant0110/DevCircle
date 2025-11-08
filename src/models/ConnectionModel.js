const mongoose = require("mongoose");

const connectionRequestSchema = new mongoose.Schema(
  {
    fromReqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toReqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["interested", "accepted", "rejected"],
      default: "interested",
    },
  },
  {
    timestamps: true,
  }
);

connectionRequestSchema.index({ fromReqId: 1, toReqId: 1 }, { unique: true });

module.exports = mongoose.model("ConnectionRequest", connectionRequestSchema);
