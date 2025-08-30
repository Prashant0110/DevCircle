const express = require("express");
const connectionRoutes = express.Router();
const ConnectionRequest = require("../models/ConnectionModel");
const auth = require("../middleware/auth");
const User = require("../models/UserModel");

const allowedStatuses = ["interested", "rejected"];

// Helper function to validate status
const validateStatus = (status) => {
  if (!allowedStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
};

// ========================
// Send connection request
// ========================
connectionRoutes.post(
  "/connection/:status/:toReqId",
  auth,
  async (req, res) => {
    try {
      const { status, toReqId } = req.params;
      const fromReqId = req.user._id;

      // Validate status
      validateStatus(status);

      // Prevent sending request to self
      if (fromReqId.toString() === toReqId) {
        throw new Error("You cannot send a connection request to yourself");
      }

      // Check if the user exists
      const toUser = await User.findById(toReqId);
      if (!toUser) {
        throw new Error("User not found with that ID");
      }

      // Check for existing request in either direction
      const existingRequest = await ConnectionRequest.findOne({
        $or: [
          { fromReqId, toReqId },
          { fromReqId: toReqId, toReqId: fromReqId },
        ],
      });

      if (existingRequest) {
        return res.status(400).json({
          message: "Connection request already exists between you two.",
        });
      }

      // Create new connection request
      const connectionRequest = new ConnectionRequest({
        fromReqId,
        toReqId,
        status,
      });

      await connectionRequest.save();

      res.status(201).json({
        message: "Connection request sent successfully",
        connectionRequest,
      });
    } catch (error) {
      console.error("Error sending connection request:", error.message);
      res.status(400).json({ message: error.message });
    }
  }
);

// ========================
// Review connection request
// ========================
connectionRoutes.post(
  "/connection/review/:status/:reqId",
  auth,
  async (req, res) => {
    try {
      const loggedInUser = req.user._id;
      const { status, reqId } = req.params;

      const allowedReviewStatuses = ["accepted", "rejected"];
      if (!allowedReviewStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const connectionRequest = await ConnectionRequest.findOne({
        _id: reqId,
        toReqId: loggedInUser,
        status: "interested",
      });

      if (!connectionRequest) {
        return res.status(404).json({
          message: "Connection request not found or already reviewed",
        });
      }

      // Update the status
      connectionRequest.status = status;
      await connectionRequest.save();

      res.status(200).json({
        message: "Connection request reviewed successfully",
        connectionRequest,
      });
    } catch (error) {
      console.error("Error reviewing connection request:", error.message);
      res.status(400).json({ message: error.message });
    }
  }
);

// ========================
// Get connection requests by status
// ========================
connectionRoutes.get("/connection/:status/me", auth, async (req, res) => {
  try {
    const loggedInUser = req.user._id.toString();
    const { status } = req.params;

    const isAllowedStatus = ["interested", "accepted"];
    if (!isAllowedStatus.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    let query = {};
    if (status === "interested") {
      // Show requests received by the logged-in user
      query = { toReqId: loggedInUser, status };
    } else {
      // Show accepted connections (matches)
      query = {
        $or: [
          { toReqId: loggedInUser, status },
          { fromReqId: loggedInUser, status },
        ],
      };
    }

    const connectionRequests = await ConnectionRequest.find(query)
      .populate("fromReqId", "firstName lastName skills age gender")
      .populate("toReqId", "firstName lastName skills age gender");

    if (!connectionRequests || connectionRequests.length === 0) {
      return res.status(200).json({
        message: "No connection requests found",
        otherUsers: [],
      });
    }

    const cleanConnections = connectionRequests.map((request) => {
      const fromId = request.fromReqId._id.toString();
      const toId = request.toReqId._id.toString();
      const otherUser =
        fromId === loggedInUser ? request.toReqId : request.fromReqId;

      return {
        _id: request._id,
        status: request.status,
        createdAt: request.createdAt,
        otherUser: {
          _id: otherUser._id,
          firstName: otherUser.firstName,
          lastName: otherUser.lastName,
          skills: otherUser.skills,
          age: otherUser.age,
          gender: otherUser.gender,
        },
      };
    });

    res.status(200).json({
      message: "Connection requests retrieved successfully",
      otherUsers: cleanConnections,
    });
  } catch (error) {
    console.error("Error fetching connection requests:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ========================
// Get user profiles for connection
// ========================
connectionRoutes.get("/connection/profiles", auth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    limit = limit > 50 ? 50 : limit;
    const skip = (page - 1) * limit;

    const connectionRequests = await ConnectionRequest.find({
      $or: [{ fromReqId: loggedInUser._id }, { toReqId: loggedInUser._id }],
    });

    const excludedUserIds = new Set();
    excludedUserIds.add(loggedInUser._id.toString());

    connectionRequests.forEach((request) => {
      excludedUserIds.add(request.fromReqId.toString());
      excludedUserIds.add(request.toReqId.toString());
    });

    const users = await User.find({
      _id: { $nin: Array.from(excludedUserIds) },
    })
      .select("firstName lastName skills age gender")
      .skip(skip)
      .limit(limit);

    res.json({ data: users });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ========================
// Get pending connection requests sent by user
// ========================
connectionRoutes.get("/connection/pending/sent", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const sentRequests = await ConnectionRequest.find({
      fromReqId: userId,
      status: "interested",
    })
      .populate("toReqId", "firstName lastName email skills age gender")
      .sort({ createdAt: -1 });

    const formattedRequests = sentRequests.map((request) => ({
      _id: request._id,
      status: request.status,
      createdAt: request.createdAt,
      otherUser: {
        _id: request.toReqId._id,
        firstName: request.toReqId.firstName,
        lastName: request.toReqId.lastName,
        email: request.toReqId.email,
        skills: request.toReqId.skills,
        age: request.toReqId.age,
        gender: request.toReqId.gender,
      },
    }));

    res.status(200).json({
      success: true,
      otherUsers: formattedRequests,
    });
  } catch (error) {
    console.error("Error fetching sent requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sent requests",
    });
  }
});

// ========================
// Get matches (accepted connections)
// ========================
connectionRoutes.get("/connection/accepted/me", auth, async (req, res) => {
  try {
    const loggedInUser = req.user._id.toString();

    // Find all accepted connections involving current user
    const connections = await ConnectionRequest.find({
      $or: [
        { fromReqId: loggedInUser, status: "accepted" },
        { toReqId: loggedInUser, status: "accepted" },
      ],
    })
      .populate("fromReqId", "firstName lastName email age gender skills")
      .populate("toReqId", "firstName lastName email age gender skills")
      .sort({ updatedAt: -1 });

    // Get unique matches (avoid duplicates for mutual connections)
    const matchesMap = new Map();

    connections.forEach((conn) => {
      const otherUser =
        conn.fromReqId._id.toString() === loggedInUser
          ? conn.toReqId
          : conn.fromReqId;

      const matchKey = otherUser._id.toString();

      if (!matchesMap.has(matchKey)) {
        matchesMap.set(matchKey, {
          _id: conn._id,
          status: conn.status,
          createdAt: conn.createdAt,
          updatedAt: conn.updatedAt,
          otherUser: {
            _id: otherUser._id,
            firstName: otherUser.firstName,
            lastName: otherUser.lastName,
            email: otherUser.email,
            skills: otherUser.skills,
            age: otherUser.age,
            gender: otherUser.gender,
          },
        });
      }
    });

    const otherUsers = Array.from(matchesMap.values());

    res.json({
      success: true,
      otherUsers,
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch matches",
    });
  }
});

// ========================
// Get user profile by ID
// ========================
connectionRoutes.get("/profile/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select("-password -refreshToken")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
    });
  }
});

module.exports = connectionRoutes;
