const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const Connection = require("../models/Connection");
const User = require("../models/User");

// Get user profiles for swiping (exclude already swiped users)
router.get("/profiles", isAuthenticated, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const currentUserId = req.user._id;

    // Get all user IDs that current user has already interacted with
    const existingConnections = await Connection.find({
      fromUser: currentUserId,
    }).select("toUser");

    const excludedUserIds = existingConnections.map((conn) => conn.toUser);
    excludedUserIds.push(currentUserId); // Exclude current user

    // Find users not in excluded list
    const users = await User.find({
      _id: { $nin: excludedUserIds },
    })
      .select("firstName lastName email age gender skills")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching profiles:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profiles",
    });
  }
});

// Send connection request (interested/rejected)
router.post("/:status/:toUserId", isAuthenticated, async (req, res) => {
  try {
    const { status, toUserId } = req.params;
    const fromUserId = req.user._id;

    if (!["interested", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be interested or rejected",
      });
    }

    // Check if connection already exists
    const existingConnection = await Connection.findOne({
      fromUser: fromUserId,
      toUser: toUserId,
    });

    if (existingConnection) {
      return res.status(400).json({
        success: false,
        message: "Connection already exists",
      });
    }

    // Create new connection
    const connection = new Connection({
      fromUser: fromUserId,
      toUser: toUserId,
      status,
    });

    await connection.save();

    // If status is interested, check for mutual interest
    if (status === "interested") {
      const mutualConnection = await Connection.findOne({
        fromUser: toUserId,
        toUser: fromUserId,
        status: "interested",
      });

      if (mutualConnection) {
        // Update both connections to accepted
        await Connection.updateOne(
          { _id: connection._id },
          { status: "accepted" }
        );
        await Connection.updateOne(
          { _id: mutualConnection._id },
          { status: "accepted" }
        );

        return res.json({
          success: true,
          message: "It's a match!",
          match: true,
        });
      }
    }

    res.json({
      success: true,
      message: "Connection request sent",
      match: false,
    });
  } catch (error) {
    console.error("Error sending connection request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send connection request",
    });
  }
});

// Get connection requests received by current user
router.get("/:status/me", isAuthenticated, async (req, res) => {
  try {
    const { status } = req.params;
    const currentUserId = req.user._id;

    if (!["interested", "rejected", "accepted"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Find connections where current user is the recipient
    const connections = await Connection.find({
      toUser: currentUserId,
      status,
    })
      .populate("fromUser", "firstName lastName email age gender skills")
      .sort({ createdAt: -1 });

    const otherUsers = connections.map((conn) => ({
      _id: conn._id,
      otherUser: conn.fromUser,
      status: conn.status,
      createdAt: conn.createdAt,
    }));

    res.json({
      success: true,
      otherUsers,
    });
  } catch (error) {
    console.error("Error fetching connection requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch connection requests",
    });
  }
});

// Get pending requests sent by current user
router.get("/pending/sent", isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Find connections where current user sent interested request but not yet accepted/rejected
    const connections = await Connection.find({
      fromUser: currentUserId,
      status: "interested",
    })
      .populate("toUser", "firstName lastName email age gender skills")
      .sort({ createdAt: -1 });

    // Filter out connections where the other user has already responded
    const pendingConnections = [];

    for (const conn of connections) {
      const reciprocalConnection = await Connection.findOne({
        fromUser: conn.toUser._id,
        toUser: currentUserId,
      });

      // If no reciprocal connection exists, it's still pending
      if (!reciprocalConnection) {
        pendingConnections.push({
          _id: conn._id,
          otherUser: conn.toUser,
          status: conn.status,
          createdAt: conn.createdAt,
        });
      }
    }

    res.json({
      success: true,
      otherUsers: pendingConnections,
    });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending requests",
    });
  }
});

// Review connection request (accept/reject)
router.post(
  "/review/:status/:connectionId",
  isAuthenticated,
  async (req, res) => {
    try {
      const { status, connectionId } = req.params;
      const currentUserId = req.user._id;

      if (!["accepted", "rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status. Must be accepted or rejected",
        });
      }

      // Find the connection request
      const connection = await Connection.findOne({
        _id: connectionId,
        toUser: currentUserId,
        status: "interested",
      });

      if (!connection) {
        return res.status(404).json({
          success: false,
          message: "Connection request not found",
        });
      }

      if (status === "accepted") {
        // Create reciprocal connection
        const reciprocalConnection = new Connection({
          fromUser: currentUserId,
          toUser: connection.fromUser,
          status: "accepted",
        });

        await reciprocalConnection.save();

        // Update original connection to accepted
        connection.status = "accepted";
        await connection.save();

        res.json({
          success: true,
          message: "Connection accepted - It's a match!",
          match: true,
        });
      } else {
        // Create reciprocal rejection
        const reciprocalConnection = new Connection({
          fromUser: currentUserId,
          toUser: connection.fromUser,
          status: "rejected",
        });

        await reciprocalConnection.save();

        // Update original connection to rejected
        connection.status = "rejected";
        await connection.save();

        res.json({
          success: true,
          message: "Connection rejected",
        });
      }
    } catch (error) {
      console.error("Error reviewing connection request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to review connection request",
      });
    }
  }
);

// Get matches (accepted connections)
router.get("/accepted/me", isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Find all accepted connections involving current user
    const connections = await Connection.find({
      $or: [
        { fromUser: currentUserId, status: "accepted" },
        { toUser: currentUserId, status: "accepted" },
      ],
    })
      .populate("fromUser", "firstName lastName email age gender skills")
      .populate("toUser", "firstName lastName email age gender skills")
      .sort({ updatedAt: -1 });

    // Get unique matches (avoid duplicates for mutual connections)
    const matchesMap = new Map();

    connections.forEach((conn) => {
      const otherUser =
        conn.fromUser._id.toString() === currentUserId.toString()
          ? conn.toUser
          : conn.fromUser;

      const matchKey = otherUser._id.toString();

      if (!matchesMap.has(matchKey)) {
        matchesMap.set(matchKey, {
          _id: conn._id,
          otherUser,
          status: conn.status,
          createdAt: conn.createdAt,
          updatedAt: conn.updatedAt,
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

// Get user profile by ID
router.get("/profile/:userId", isAuthenticated, async (req, res) => {
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

// Add these routes to your existing Routes/connectionRoutes.js file

// Get pending connection requests sent by the user

module.exports = router;
