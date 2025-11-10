const express = require("express");
const profileRoutes = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/UserModel");

// Get current user profile
profileRoutes.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: user,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Update user profile - THIS IS THE MISSING ROUTE
profileRoutes.put("/profile", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;

    console.log("Updating profile for user:", userId);
    console.log("Update data:", updateData);

    // Remove sensitive fields that shouldn't be updated
    delete updateData.password;
    delete updateData._id;
    delete updateData.email;
    // Validate required fields if needed
    if (updateData.firstName && updateData.firstName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "First name must be at least 2 characters long",
      });
    }

    if (updateData.lastName && updateData.lastName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Last name must be at least 2 characters long",
      });
    }

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
        select: "-password",
      }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log("Profile updated successfully:", updatedUser);

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationErrors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get user profile by ID (for viewing other users)
profileRoutes.get("/profile/:userId", auth, async (req, res) => {
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

// Upload profile picture (if you want this feature)
profileRoutes.post("/upload-picture", auth, async (req, res) => {
  try {
    res.status(501).json({
      success: false,
      message: "Profile picture upload not implemented yet",
    });
  } catch (error) {
    console.error("Error uploading picture:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = profileRoutes;
