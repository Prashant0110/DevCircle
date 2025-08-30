const express = require("express");
const profileRoutes = express.Router();
const User = require("../models/UserModel");
const JWT = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const auth = require("../middleware/auth");
const ConnectionRequest = require("../models/ConnectionModel");

profileRoutes.get("/profile", auth, async (req, res) => {
  try {
    const userProfile = await User.findById(req.user._id);
    if (!userProfile) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(userProfile);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

profileRoutes.patch("/updateUser", auth, async (req, res) => {
  const data = req.body;
  const userId = req.user._id;

  try {
    const allowedUpdates = [
      "firstName",
      "lastName",
      "password",
      "skills",
      "age",
    ];

    const updates = Object.fromEntries(
      Object.entries(data).filter(([key]) => allowedUpdates.includes(key))
    );

    if (Object.keys(updates).length === 0) {
      return res.status(400).send("No valid fields to update");
    }

    // Normalize skills
    if (updates.skills && Array.isArray(updates.skills)) {
      updates.skills = updates.skills.map((skill) => skill.toLowerCase());
    }

    // Hash the password if it's being updated
    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).send("User not found");
    }

    res.status(200).send("User updated successfully");
  } catch (error) {
    console.error("Update error:", error.message);
    res.status(500).send("Error updating user");
  }
});

// Get user profile by ID
profileRoutes.get("/profile/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("-password").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get connection status between current user and requested user
    const currentUserId = req.user._id;
    const connectionStatus = await ConnectionRequest.findOne({
      $or: [
        { fromReqId: currentUserId, toReqId: userId },
        { fromReqId: userId, toReqId: currentUserId },
      ],
    });

    res.json({
      success: true,
      data: {
        ...user,
        connectionStatus: connectionStatus ? connectionStatus.status : null,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
    });
  }
});

module.exports = profileRoutes;
