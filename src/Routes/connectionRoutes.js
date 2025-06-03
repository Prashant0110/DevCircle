const express = require("express");
const connectionRoutes = express.Router();
const ConnectionRequest = require("../model/ConnectionModel");
const auth = require("../middleware/auth");
const User = require("../model/UserModel");

const allowedStatuses = ["interested", "rejected"];

const validateStatus = (status) => {
  if (!allowedStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
};

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

connectionRoutes.post(
  "/connection/review/:status/:reqId",
  auth,
  async (req, res) => {
    try {
      //fromReqId has send it to ToReqId
      //then ToReqId should be the one to accept or reject it

      const loggedInUser = req.user._id;

      const { status, reqId } = req.params;

      // Validate status
      const allowedStatuses = ["accepted", "rejected"];
      if (!allowedStatuses.includes(status)) {
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

      // Update the status of the connection request
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

// Get all connection requests for a user

//1. loggedInUser-> get all the connection requests sent to him
//[interested] list that i got from other users
//2. loggedInUser-> get all the connection requests that i sent to other users
//[interested] list that i sent to other users
//[accepted] list that i accepted from other users
//list that other users accepted me

connectionRoutes.get("/connection/:status/me", auth, async (req, res) => {
  try {
    const loggedInUser = req.user._id.toString();
    const { status } = req.params;

    const isAllowedStatus = ["interested", "accepted"];
    if (!isAllowedStatus.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const connectionRequests = await ConnectionRequest.find({
      $or: [
        { toReqId: loggedInUser, status },
        { fromReqId: loggedInUser, status },
      ],
    })
      .populate("fromReqId", "firstName lastName skills age gender")
      .populate("toReqId", "firstName lastName skills age gender");

    if (!connectionRequests || connectionRequests.length === 0) {
      return res.status(404).json({ message: "No connection requests found" });
    }

    const cleanConnections = connectionRequests.map((request) => {
      const fromId = request.fromReqId._id.toString();
      const toId = request.toReqId._id.toString();

      const otherUser =
        fromId === loggedInUser ? request.toReqId : request.fromReqId;

      return {
        _id: request._id,
        status: request.status,
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
      connectionRequests,
    });
  } catch (error) {
    console.error("Error fetching connection requests:", error.message);
    res.status(400).json({ message: error.message });
  }
});

connectionRoutes.get("/connection/requests/:status", auth, async (req, res) => {
  try {
    const loggedInUser = req.user._id;
    const { status } = req.params;

    const isAllowedStatus = ["interested", "accepted"];
    if (!isAllowedStatus.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const connectionRequests = await ConnectionRequest.find({
      $or: [
        { toReqId: loggedInUser, status: status },
        { fromReqId: loggedInUser, status: status },
      ],
    }).populate("fromReqId", "firstName lastName skills age gender");

    if (!connectionRequests || connectionRequests.length === 0) {
      return res.status(404).json({ message: "No connection requests found" });
    }

    const data = connectionRequests.map((item) => item.fromReqId);

    res.status(200).json({
      message: "Connection requests retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("Error retrieving connection requests:", error.message);
    res.status(400).json({ message: error.message });
  }
});

// connectionRoutes.get("/connection/profiles", auth, async (req, res) => {
//   const { gender, minAge, maxAge, skills } = req.query;
//   const hasFilter = gender || minAge || maxAge || skills;

//   const page = parseInt(req.query.page) || 1;
//   let limit = parseInt(req.query.limit) || 10;
//   limit > 10 ? (limit = 10) : limit;
//   const skip = (page - 1) * limit;

//   try {
//     const excludedUserIds = [
//       ...(await ConnectionRequest.find({ fromReqId: req.user._id }).distinct(
//         "toReqId"
//       )),
//       ...(await ConnectionRequest.find({ toReqId: req.user._id }).distinct(
//         "fromReqId"
//       )),
//       req.user._id,
//     ];

//     if (!hasFilter) {
//       // No filters → Use simple find
//       const userCollections = await User.find(
//         {
//           _id: { $nin: excludedUserIds },
//         },
//         "firstName lastName skills age gender"
//       )
//         .skip(skip)
//         .limit(limit);

//       return res.status(200).json({
//         message: "Connection requests retrieved successfully (no filter)",
//         userCollections,
//       });
//     } else {
//       // Filters present → Use aggregation
//       let match = {
//         _id: { $nin: excludedUserIds },
//       };

//       if (gender) match.gender = gender;

//       if (minAge || maxAge) {
//         match.age = {};
//         if (minAge) match.age.$gte = parseInt(minAge);
//         if (maxAge) match.age.$lte = parseInt(maxAge);
//       }

//       if (skills) {
//         if (skills) {
//           const skillArray = skills
//             .split(",")
//             .map((s) => s.trim().toLowerCase());

//           match.skills = { $in: skillArray };
//         }
//       }
//       const userCollections = await User.aggregate([
//         { $match: match },
//         {
//           $project: {
//             firstName: 1,
//             lastName: 1,
//             skills: 1,
//             age: 1,
//             gender: 1,
//           },
//         },
//         { $sort: { relevence: -1 } },
//         { $skip: skip },
//         { $limit: limit },
//       ]);

//       return res.status(200).json({
//         message: "Connection requests retrieved with filters",
//         userCollections,
//       });
//     }
//   } catch (error) {
//     console.error("Error retrieving connection requests:", error.message);
//     return res.status(400).json({ message: error.message });
//   }
// });

connectionRoutes.get("/connection/profiles", auth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    limit = limit > 50 ? 50 : limit;
    const skip = (page - 1) * limit;

    // Get all connection requests where the logged-in user is involved (either sender or receiver)
    const connectionRequests = await ConnectionRequest.find({
      $or: [
        { fromReqId: loggedInUser._id }, // Requests I've sent
        { toReqId: loggedInUser._id }, // Requests I've received
      ],
    });

    // Collect all user IDs we should exclude from the feed
    const excludedUserIds = new Set();
    excludedUserIds.add(loggedInUser._id.toString()); // Exclude myself

    connectionRequests.forEach((request) => {
      // If I'm the sender, exclude the receiver
      if (request.fromReqId.toString() === loggedInUser._id.toString()) {
        excludedUserIds.add(request.toReqId.toString());
      }
      // If I'm the receiver, exclude the sender
      if (request.toReqId.toString() === loggedInUser._id.toString()) {
        excludedUserIds.add(request.fromReqId.toString());
      }
    });

    // Get users not in the excluded list
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

module.exports = connectionRoutes;
