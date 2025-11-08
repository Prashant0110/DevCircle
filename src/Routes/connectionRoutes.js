const express = require("express");
const connectionRoutes = express.Router();
const ConnectionRequest = require("../models/ConnectionModel");
const auth = require("../middleware/auth");
const User = require("../models/UserModel");
const MatchingAlgorithm = require("../utils/matchingAlgorithm");

// Get user profiles with OPTIONAL smart matching
connectionRoutes.get("/profiles", auth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    limit = limit > 50 ? 50 : limit;
    const skip = (page - 1) * limit;

    // Smart matching parameters (optional)
    const smartMatch = req.query.smartMatch === "true";
    const minThreshold = parseInt(req.query.minThreshold) || 30;

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
    }).select("firstName lastName skills age gender");

    let processedUsers;

    if (smartMatch && MatchingAlgorithm) {
      console.log(`🧠 Smart matching enabled with ${minThreshold}% threshold`);
      processedUsers = MatchingAlgorithm.rankUsersByMatch(
        loggedInUser,
        users,
        minThreshold
      );
      processedUsers = processedUsers.slice(skip, skip + limit);
      console.log(
        `📊 Found ${processedUsers.length} users above ${minThreshold}% match`
      );
    } else {
      processedUsers = users.slice(skip, skip + limit).map((user) => ({
        ...user.toObject(),
        matchPercentage: null,
        matchBreakdown: null,
      }));
    }

    res.json({
      success: true,
      data: processedUsers,
      smartMatch,
      minThreshold: smartMatch ? minThreshold : null,
      totalFound: processedUsers.length,
    });
  } catch (err) {
    console.error("Error in profiles endpoint:", err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get received requests (people interested in me)
connectionRoutes.get("/interested/me", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("Fetching received requests for user:", userId);

    const requests = await ConnectionRequest.find({
      toReqId: userId,
      status: "interested",
    }).populate("fromReqId", "firstName lastName email age gender skills");

    console.log("Found requests:", requests);

    // Format the response properly
    const formattedRequests = requests.map((request) => {
      console.log("Processing request:", request);
      return {
        _id: request._id,
        status: request.status,
        createdAt: request.createdAt,
        otherUser: request.fromReqId, // The person who sent the request
        fromReqId: request.fromReqId,
        toReqId: request.toReqId,
      };
    });

    console.log("Formatted requests:", formattedRequests);

    res.status(200).json({
      success: true,
      data: formattedRequests,
    });
  } catch (error) {
    console.error("Error fetching received requests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get sent requests (requests I sent)
connectionRoutes.get("/pending/sent", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("Fetching sent requests for user:", userId);

    const requests = await ConnectionRequest.find({
      fromReqId: userId,
      status: "interested",
    }).populate("toReqId", "firstName lastName email age gender skills");

    console.log("Found sent requests:", requests);

    // Format the response properly
    const formattedRequests = requests.map((request) => {
      console.log("Processing sent request:", request);
      return {
        _id: request._id,
        status: request.status,
        createdAt: request.createdAt,
        otherUser: request.toReqId, // The person I sent request to
        fromReqId: request.fromReqId,
        toReqId: request.toReqId,
      };
    });

    console.log("Formatted sent requests:", formattedRequests);

    res.status(200).json({
      success: true,
      data: formattedRequests,
    });
  } catch (error) {
    console.error("Error fetching sent requests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Send interest to a user
connectionRoutes.post("/interested/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const fromUserId = req.user._id;

    console.log(`User ${fromUserId} sending interest to ${userId}`);

    // Check if user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is trying to send interest to themselves
    if (fromUserId.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "Cannot send interest to yourself",
      });
    }

    // Check if connection request already exists
    const existingRequest = await ConnectionRequest.findOne({
      $or: [
        { fromReqId: fromUserId, toReqId: userId },
        { fromReqId: userId, toReqId: fromUserId },
      ],
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "Connection request already exists",
      });
    }

    // Create new connection request
    const connectionRequest = new ConnectionRequest({
      fromReqId: fromUserId,
      toReqId: userId,
      status: "interested",
    });

    await connectionRequest.save();
    console.log("Interest sent successfully:", connectionRequest);

    res.status(200).json({
      success: true,
      message: "Interest sent successfully",
      data: connectionRequest,
    });
  } catch (error) {
    console.error("Error sending interest:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get matches (accepted connections)
connectionRoutes.get("/accepted/me", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("Fetching matches for user:", userId);

    const matches = await ConnectionRequest.find({
      $or: [
        { fromReqId: userId, status: "accepted" },
        { toReqId: userId, status: "accepted" },
      ],
    }).populate(
      "fromReqId toReqId",
      "firstName lastName email age gender skills"
    );

    console.log("Found matches:", matches);

    // Format the response to show the other user
    const formattedMatches = matches.map((match) => {
      const otherUser =
        match.fromReqId._id.toString() === userId.toString()
          ? match.toReqId
          : match.fromReqId;

      return {
        _id: match._id,
        otherUser,
        status: match.status,
        createdAt: match.createdAt,
      };
    });

    console.log("Formatted matches:", formattedMatches);

    res.status(200).json({
      success: true,
      otherUsers: formattedMatches,
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Review connection request (accept/reject)
connectionRoutes.post("/review/:status/:requestId", auth, async (req, res) => {
  try {
    const { status, requestId } = req.params;
    const userId = req.user._id;

    console.log(
      `User ${userId} reviewing request ${requestId} with status ${status}`
    );

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const request = await ConnectionRequest.findOne({
      _id: requestId,
      toReqId: userId,
      status: "interested",
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Connection request not found",
      });
    }

    request.status = status;
    await request.save();

    console.log("Request reviewed successfully:", request);

    res.status(200).json({
      success: true,
      message: `Connection request ${status}`,
      data: request,
    });
  } catch (error) {
    console.error("Error reviewing request:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Reject user
connectionRoutes.post("/rejected/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const fromUserId = req.user._id;

    console.log(`User ${fromUserId} rejecting user ${userId}`);

    // Check if user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if connection request already exists
    const existingRequest = await ConnectionRequest.findOne({
      $or: [
        { fromReqId: fromUserId, toReqId: userId },
        { fromReqId: userId, toReqId: fromUserId },
      ],
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "Connection request already exists",
      });
    }

    // Create rejection record
    const connectionRequest = new ConnectionRequest({
      fromReqId: fromUserId,
      toReqId: userId,
      status: "rejected",
    });

    await connectionRequest.save();
    console.log("User rejected successfully:", connectionRequest);

    res.status(200).json({
      success: true,
      message: "User rejected",
      data: connectionRequest,
    });
  } catch (error) {
    console.error("Error rejecting user:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get detailed match analysis for a specific user
connectionRoutes.get("/match-analysis/:userId", auth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const { userId } = req.params;

    const targetUser = await User.findById(userId).select(
      "firstName lastName skills age gender"
    );

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let matchData = { percentage: 0, breakdown: {} };

    if (MatchingAlgorithm) {
      matchData = MatchingAlgorithm.calculateMatchPercentage(
        loggedInUser,
        targetUser
      );
    }

    res.json({
      success: true,
      targetUser: {
        _id: targetUser._id,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        skills: targetUser.skills,
        age: targetUser.age,
        gender: targetUser.gender,
      },
      matchAnalysis: matchData,
    });
  } catch (error) {
    console.error("Error in match analysis:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get user profile by ID (for viewing profiles)
connectionRoutes.get("/user/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("-password");

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
      message: "Internal server error",
    });
  }
});

module.exports = connectionRoutes;
