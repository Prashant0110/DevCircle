const express = require("express");
const authRoutes = express.Router();
const User = require("../model/UserModel");
const { validateSignupData } = require("../utils/validation");
const bcrypt = require("bcrypt");
const auth = require("../middleware/auth");

authRoutes.post("/register", async (req, res) => {
  try {
    validateSignupData(req.body);

    // Changed from req.body.emailId to req.body.email
    const { firstName, lastName, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Return user data without password
    const userData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };

    res.status(201).json({
      message: "User registered successfully",
      user: userData,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({
      message: error.message || "Internal server error",
    });
  }
});

authRoutes.post("/login", async (req, res) => {
  try {
    // Changed to email
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = await user.getJWT();
    res.cookie("token", token);

    // Return user data without password
    const userData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };

    res.status(200).json({
      message: "Login successful",
      user: userData,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({
      message: error.message || "Internal server error",
    });
  }
});

authRoutes.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    //set jwt token
    const token = await user.getJWT();

    // Send the token as a cookie
    res.cookie("token", token);
    res.status(200).json({ message: "Login successful" });
  } catch (error) {
    if (error.message) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Error logging in:", error);
    res.status(500).json("internal server error");
  }
});

authRoutes.post("/logout", auth, async (req, res) => {
  res.clearCookie("token", null, {
    expires: new Date(Date.now()),
  });
  res
    .status(200)
    // .json({ message: ` ${user.firstName} has Logout successfully` });
    .json({ message: `${req.user.firstName} has Logout successfully` });
});

module.exports = authRoutes;
