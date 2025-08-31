const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");

const auth = async (req, res, next) => {
  try {
    // Check for token in Authorization header or cookie
    let token =
      req.header("Authorization")?.replace("Bearer ", "") || req.cookies.token;

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded._id) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid token payload" });
    }

    // Find user by ID
    const user = await User.findById(decoded._id).select("-password"); // Exclude password for security
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    const status = error.name === "JsonWebTokenError" ? 401 : 500;
    res.status(status).json({
      success: false,
      message: status === 401 ? "Invalid token" : "Internal server error",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

module.exports = auth;
