const express = require("express");
const profileRoutes = express.Router();
const User = require("../model/UserModel");
const JWT = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const auth = require("../middleware/auth");

profileRoutes.get("/profile", async (req, res) => {
  try {
    const { token } = req.cookies;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const decodedData = JWT.verify(token, process.env.JWT_SECRET);
    const userProfile = await User.findById(decodedData._id);
    if (!userProfile) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(userProfile);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
//   try {
//     const userEmail = req.query.email;
//     const userDelete = await User.findOneAndDelete({ email: userEmail });
//     if (userDelete) {
//       res.send(`user ${userEmail} deleted successfully`);
//     } else {
//       res.send("User not found");
//     }
//   } catch (error) {
//     res.status(500).send("Error fetching users");
//   }
// });

profileRoutes.patch("/updateUser", auth, async (req, res) => {
  const data = req.body;
  const userId = req.body.userId;

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

    // ✅ Hash the password if it's being updated
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

module.exports = profileRoutes;
