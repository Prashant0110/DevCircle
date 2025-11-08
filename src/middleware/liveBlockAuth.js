const { Liveblocks } = require("@liveblocks/node");

// Don't load dotenv here - it should already be loaded in server.js
// Remove: const { configDotenv } = require("dotenv");
// Remove: configDotenv();

// Add a check to ensure the key exists
if (!process.env.LIVEBLOCKS_SECRET_KEY) {
  console.error(
    "ERROR: LIVEBLOCKS_SECRET_KEY is not set in environment variables"
  );
  throw new Error("LIVEBLOCKS_SECRET_KEY is required");
}

if (!process.env.LIVEBLOCKS_SECRET_KEY.startsWith("sk_")) {
  console.error("ERROR: Invalid LIVEBLOCKS_SECRET_KEY format");
  throw new Error("LIVEBLOCKS_SECRET_KEY must start with 'sk_'");
}

// Initialize Liveblocks with your secret key
const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY,
});

// Middleware to authorize Liveblocks users
const authorizeLiveblocksUser = async (req, res) => {
  try {
    // Get user from your authentication system
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Create a session for the user
    const session = liveblocks.prepareSession(user._id.toString(), {
      userInfo: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
    });

    // Use a room from the request body
    const { room } = req.body;
    if (room) {
      // Allow access to the room
      session.allow(room, session.FULL_ACCESS);
    }

    // Authorize the user and return the response
    const { status, body } = await session.authorize();
    res.status(status).end(body);
  } catch (e) {
    console.error("Liveblocks authentication error:", e);
    res.status(500).json({ error: "Authentication error" });
  }
};

module.exports = { authorizeLiveblocksUser };
