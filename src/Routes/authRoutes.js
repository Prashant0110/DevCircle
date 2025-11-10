const express = require("express");
const authRoutes = express.Router();
const User = require("../models/UserModel");
const { validateSignupData } = require("../utils/validation");
const bcrypt = require("bcrypt");
const auth = require("../middleware/auth");

// Register
authRoutes.post("/register", async (req, res) => {
  try {
    validateSignupData(req.body);
    const { firstName, lastName, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });
    await user.save();

    const userData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };

    res
      .status(201)
      .json({ message: "User registered successfully", user: userData });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: error.message || "Internal server error" });
  }
});

// Login
// Login
authRoutes.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid)
      return res.status(401).json({ message: "Invalid email or password" });

    const token = await user.getJWT();

    // Set cookie
    res.cookie("token", token);

    const userData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };

    res.status(200).json({
      message: "Login successful",
      user: userData,
      token: token,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: error.message || "Internal server error" });
  }
});

// Logout
authRoutes.post("/logout", auth, async (req, res) => {
  res.clearCookie("token", null, { expires: new Date(Date.now()) });
  res
    .status(200)
    .json({ message: `${req.user.firstName} has logged out successfully` });
});

module.exports = authRoutes;
