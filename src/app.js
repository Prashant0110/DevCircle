const express = require("express");
const app = express();
const connectDB = require("./config/database");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const authRoutes = require("./Routes/authRoutes");
const profileRoutes = require("./Routes/profileRoutes");
const connectionRoutes = require("./Routes/connectionRoutes");
// Load environment variables from .env file
dotenv.config();
connectDB()
  .then(() => {
    console.log("MongoDB connected");
    // Start your server here
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// Middleware

const cors = require("cors");

app.use(
  cors({
    origin: [
      "http://localhost:5173", // Keep existing Vite dev server
      "http://127.0.0.1:5500", // Add VS Code Live Server address
      "http://localhost:5500", // Also include localhost:5500 for consistency
      "http://localhost:3000", // Also include localhost:5500 for consistency
    ],
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Access-Control-Allow-Origin",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use("/user", authRoutes);
app.use("/user", profileRoutes);
app.use("/user", connectionRoutes);

module.exports = app;
