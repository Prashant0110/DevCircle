const mongoose = require("mongoose");
const { Schema } = mongoose;

const connectionSchema = new Schema({
  fromReqId: {
    ref: "User",
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  toReqId: {
    ref: "User",
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "interested"],
    message: "{VALUE} is not a valid status",
    required: true,
  },
  timestamps: {
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
});

connectionSchema.index({ fromReqId: 1, toReqId: 1 });

const ConnectionRequest = mongoose.model("ConnectionRequest", connectionSchema);
module.exports = ConnectionRequest;
