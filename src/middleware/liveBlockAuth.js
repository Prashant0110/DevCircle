const { Liveblocks } = require("@liveblocks/node");
const { configDotenv } = require("dotenv");
configDotenv();

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
      userInfo: { name: user.username, avatar: user.avatar },
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
    res.status(500).send("Authentication error");
  }
};

module.exports = { authorizeLiveblocksUser };
