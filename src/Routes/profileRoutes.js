const express = require("express");
const profileRoutes = express.Router();
const User = require("../model/UserModel");
const JWT = require("jsonwebtoken");

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

profileRoutes.patch("/updateUser", async (req, res) => {
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

    // const isValidUpdate = Object.fromEntries(
    //   Object.entries(data).filter(([key]) => allowedUpdates.includes(key))
    // );

    // if (Object.keys(isValidUpdate).length === 0) {
    //   return res.status(400).send("No valid fields to update");
    // }
    const isValidUpdate = Object.keys(data).every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidUpdate) {
      throw new Error("Invalid update fields");
    }
    if (data.skills && Array.isArray(data.skills)) {
      data.skills = data.skills.map((skill) => skill.toLowerCase());
    }
    const updateUser = await User.findByIdAndUpdate(userId, isValidUpdate, {
      new: true,
      runValidators: true,
    });
    // await updateUser.save();
    res.status(200).send("User updated successfully");
  } catch (error) {
    res.status(500).send("Error updating user");
  }
});
module.exports = { profileRoutes };
