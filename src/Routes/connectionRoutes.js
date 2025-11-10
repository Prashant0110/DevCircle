const express = require("express");
const router = express.Router();
const ConnectionRequest = require("../models/ConnectionModel");
const User = require("../models/UserModel");
const auth = require("../middleware/auth");

// Debug middleware
router.use((req, res, next) => {
  console.log(`Connection Route: ${req.method} ${req.path}`);
  console.log("User:", req.user ? req.user._id : "No user");
  next();
});

// Get accepted connections (matched users) - ADDED ROUTE
router.get("/accepted/me", auth, async (req, res) => {
  try {
    console.log("=== FETCHING ACCEPTED CONNECTIONS ===");
    console.log("Current user ID:", req.user._id);

    // Find all accepted connections where current user is involved
    const connections = await ConnectionRequest.find({
      $or: [
        { fromReqId: req.user._id, status: "accepted" },
        { toReqId: req.user._id, status: "accepted" },
      ],
    })
      .populate("fromReqId", "firstName lastName email")
      .populate("toReqId", "firstName lastName email");

    console.log("Found connections:", connections.length);

    // Extract the other users (not the current user)
    const otherUsers = connections.map((connection) => {
      const otherUser =
        connection.fromReqId._id.toString() === req.user._id.toString()
          ? connection.toReqId
          : connection.fromReqId;

      return {
        connectionId: connection._id,
        otherUser: otherUser,
        connectedAt: connection.createdAt,
        status: connection.status,
      };
    });

    console.log("Processed other users:", otherUsers.length);

    res.json({
      success: true,
      otherUsers: otherUsers,
      count: otherUsers.length,
    });
  } catch (error) {
    console.error("Error fetching accepted connections:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get connection requests received (interested in me)
router.get("/interested/me", auth, async (req, res) => {
  try {
    console.log("=== FETCHING RECEIVED REQUESTS ===");
    console.log("Current user ID:", req.user._id);

    const requests = await ConnectionRequest.find({
      toReqId: req.user._id,
      status: "interested",
    })
      .populate("fromReqId", "firstName lastName email skills age")
      .sort({ createdAt: -1 });

    console.log("Found received requests:", requests.length);

    res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error) {
    console.error("Error fetching received requests:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get connection requests sent by me
router.get("/pending/sent", auth, async (req, res) => {
  try {
    console.log("=== FETCHING SENT REQUESTS ===");
    console.log("Current user ID:", req.user._id);

    const requests = await ConnectionRequest.find({
      fromReqId: req.user._id,
      status: "interested",
    })
      .populate("toReqId", "firstName lastName email skills age")
      .sort({ createdAt: -1 });

    console.log("Found sent requests:", requests.length);

    res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error) {
    console.error("Error fetching sent requests:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Send interest to a user
router.post("/interested/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    console.log("=== SENDING INTEREST ===");
    console.log("From:", currentUserId);
    console.log("To:", userId);

    // Check if user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is trying to connect with themselves
    if (currentUserId.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "Cannot send interest to yourself",
      });
    }

    // Check if connection already exists
    const existingConnection = await ConnectionRequest.findOne({
      $or: [
        { fromReqId: currentUserId, toReqId: userId },
        { fromReqId: userId, toReqId: currentUserId },
      ],
    });

    if (existingConnection) {
      let message = "";
      switch (existingConnection.status) {
        case "interested":
          message = "Interest already sent or received";
          break;
        case "accepted":
          message = "Already connected";
          break;
        case "rejected":
          message = "Connection was previously rejected";
          break;
      }
      return res.status(400).json({
        success: false,
        message,
      });
    }

    // Create new connection request
    const connectionRequest = new ConnectionRequest({
      fromReqId: currentUserId,
      toReqId: userId,
      status: "interested",
    });

    await connectionRequest.save();

    console.log("Interest sent successfully");

    res.status(201).json({
      success: true,
      message: "Interest sent successfully",
      data: connectionRequest,
    });
  } catch (error) {
    console.error("Error sending interest:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Review connection request (accept/reject)
router.post("/review/:status/:requestId", auth, async (req, res) => {
  try {
    const { status, requestId } = req.params;
    const currentUserId = req.user._id;

    console.log("=== REVIEWING REQUEST ===");
    console.log("Request ID:", requestId);
    console.log("Status:", status);
    console.log("User:", currentUserId);

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'accepted' or 'rejected'",
      });
    }

    // Find the connection request
    const connectionRequest = await ConnectionRequest.findById(requestId);

    if (!connectionRequest) {
      return res.status(404).json({
        success: false,
        message: "Connection request not found",
      });
    }

    // Verify the current user is the recipient
    if (connectionRequest.toReqId.toString() !== currentUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to review this request",
      });
    }

    // Update the status
    connectionRequest.status = status;
    await connectionRequest.save();

    console.log(`Request ${status} successfully`);

    res.json({
      success: true,
      message: `Request ${status} successfully`,
      data: connectionRequest,
    });
  } catch (error) {
    console.error("Error reviewing request:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Reject a user (block future connections)
router.post("/rejected/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    console.log("=== REJECTING USER ===");
    console.log("From:", currentUserId);
    console.log("To:", userId);

    // Check if user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if connection already exists
    let connectionRequest = await ConnectionRequest.findOne({
      $or: [
        { fromReqId: currentUserId, toReqId: userId },
        { fromReqId: userId, toReqId: currentUserId },
      ],
    });

    if (connectionRequest) {
      // Update existing connection to rejected
      connectionRequest.status = "rejected";
      await connectionRequest.save();
    } else {
      // Create new rejected connection
      connectionRequest = new ConnectionRequest({
        fromReqId: currentUserId,
        toReqId: userId,
        status: "rejected",
      });
      await connectionRequest.save();
    }

    console.log("User rejected successfully");

    res.json({
      success: true,
      message: "User rejected successfully",
      data: connectionRequest,
    });
  } catch (error) {
    console.error("Error rejecting user:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// UPDATED: Get user profiles for browsing (excluding already connected/rejected users)
router.get("/profiles", auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const {
      page = 1,
      limit = 10,
      smartMatch = false,
      minThreshold = 30,
    } = req.query;

    console.log("=== FETCHING PROFILES ===");
    console.log("Current user:", currentUserId);
    console.log("Smart match:", smartMatch);
    console.log("Min threshold:", minThreshold);

    // Get users that current user has already interacted with
    const existingConnections = await ConnectionRequest.find({
      $or: [{ fromReqId: currentUserId }, { toReqId: currentUserId }],
    });

    const excludeUserIds = existingConnections.map((conn) =>
      conn.fromReqId.toString() === currentUserId.toString()
        ? conn.toReqId
        : conn.fromReqId
    );
    excludeUserIds.push(currentUserId); // Exclude self

    let users;
    let totalCount = 0;

    if (smartMatch === "true") {
      console.log("=== SMART MATCHING ENABLED ===");

      // Get current user with full details
      const currentUser = await User.findById(currentUserId);
      console.log("Current user skills:", currentUser.skills);
      console.log("Current user age:", currentUser.age);

      // Get all potential users (excluding already connected)
      const allUsers = await User.find({
        _id: { $nin: excludeUserIds },
      });

      console.log("Total potential users:", allUsers.length);

      // Import and use the matching algorithm
      const MatchingAlgorithm = require("../utils/matchingAlgorithm");

      // Rank users by match percentage
      const rankedUsers = MatchingAlgorithm.rankUsersByMatch(
        currentUser,
        allUsers,
        parseInt(minThreshold)
      );

      console.log("=== MATCHING RESULTS ===");
      // FIXED:
      rankedUsers.forEach((user) => {
        const commonSkills = user.matchBreakdown?.commonSkills || [];
        const skillsText =
          commonSkills.length > 0 ? commonSkills.join(", ") : "None";
        console.log(
          `${user.firstName} ${user.lastName}: ${user.matchPercentage}% (Common Skills: ${skillsText})`
        );
      });

      // Set total count for smart matching
      totalCount = rankedUsers.length;

      // Apply pagination to ranked results
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      users = rankedUsers.slice(startIndex, endIndex);

      console.log(
        `Showing ${users.length} users after pagination (${startIndex}-${endIndex})`
      );
      console.log(`Total matching users: ${totalCount}`);
    } else {
      console.log("=== REGULAR BROWSING ===");

      // Get total count for regular browsing
      totalCount = await User.countDocuments({
        _id: { $nin: excludeUserIds },
      });

      users = await User.find({
        _id: { $nin: excludeUserIds },
      })
        .select("firstName lastName email skills age gender")
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));
    }

    console.log("Final users count:", users.length);
    console.log("Total available users:", totalCount);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: totalPages,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
      },
      smartMatch: smartMatch === "true",
      minThreshold: parseInt(minThreshold),
      message:
        smartMatch === "true"
          ? `Showing ${users.length} users with ${minThreshold}%+ compatibility`
          : `Showing ${users.length} users`,
    });
  } catch (error) {
    console.error("Error fetching profiles:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get connection statistics
router.get("/stats", auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const [received, sent, accepted, rejected] = await Promise.all([
      ConnectionRequest.countDocuments({
        toReqId: currentUserId,
        status: "interested",
      }),
      ConnectionRequest.countDocuments({
        fromReqId: currentUserId,
        status: "interested",
      }),
      ConnectionRequest.countDocuments({
        $or: [
          { fromReqId: currentUserId, status: "accepted" },
          { toReqId: currentUserId, status: "accepted" },
        ],
      }),
      ConnectionRequest.countDocuments({
        $or: [
          { fromReqId: currentUserId, status: "rejected" },
          { toReqId: currentUserId, status: "rejected" },
        ],
      }),
    ]);

    res.json({
      success: true,
      data: {
        received,
        sent,
        accepted,
        rejected,
        total: received + sent + accepted + rejected,
      },
    });
  } catch (error) {
    console.error("Error fetching connection stats:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Remove/disconnect from a user
router.delete("/disconnect/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    console.log("=== DISCONNECTING USER ===");
    console.log("Current user:", currentUserId);
    console.log("Target user:", userId);

    const connection = await ConnectionRequest.findOne({
      $or: [
        { fromReqId: currentUserId, toReqId: userId, status: "accepted" },
        { fromReqId: userId, toReqId: currentUserId, status: "accepted" },
      ],
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: "Connection not found",
      });
    }

    await ConnectionRequest.deleteOne({ _id: connection._id });

    console.log("User disconnected successfully");

    res.json({
      success: true,
      message: "User disconnected successfully",
    });
  } catch (error) {
    console.error("Error disconnecting user:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Test route
router.get("/test", auth, (req, res) => {
  res.json({
    success: true,
    message: "Connection routes are working",
    user: req.user._id,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
