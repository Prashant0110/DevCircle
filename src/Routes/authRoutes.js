const express = require("express");
const authRoutes = express.Router();
const User = require("../model/UserModel");
const { validateSignupData } = require("../utils/validation");
const bcrypt = require("bcrypt");
const auth = require("../middleware/auth");

authRoutes.post("/register", async (req, res) => {
  try {
    // Validate request body
    validateSignupData(req.body);

    const { firstName, lastName, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(req.body);
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    if (req.body.skills && Array.isArray(req.body.skills)) {
      req.body.skills = req.body.skills.map((skill) => skill.toLowerCase());
    }

    await user.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    if (error.message) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Internal server error" });
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

module.exports = { authRoutes };
