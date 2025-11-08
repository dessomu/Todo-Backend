const jwt = require("jsonwebtoken");
const Session = require("../models/session");

// For jwt in cookie
// module.exports = function authMiddleware(req, res, next) {
//   const token = req.cookies.auth_token;
//   if (!token) return res.status(401).json({ message: "Unauthorized" });

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded; // attach user to request
//     next();
//   } catch (err) {
//     console.log(err);
//     res.status(401).json({ message: "Invalid cookie" });
//   }
// };

module.exports = async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1]; // check token in header
    const sessionMarker = req.headers["x-session-marker"]; // check session_marker in header

    if (!token || !sessionMarker)
      return res.status(401).json({ message: "Unauthorized" });

    // verify jwt and check for session in DB
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await Session.findOne({
      userId: decoded.uid,
      sessionId: sessionMarker,
    });
    if (!session) return res.status(401).json({ message: "Invalid session" });

    req.user = decoded;
    console.log(decoded);

    next();
  } catch (err) {
    res.status(401).json({ message: "Unauthorized", err });
  }
};
