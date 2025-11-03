// const admin = require("firebase-admin");

// const verifyFirebaseToken = async (req, res, next) => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }

//   const token = authHeader.split(" ")[1];

//   try {
//     const decodedToken = await admin.auth().verifyIdToken(token);
//     req.user = decodedToken; // attach user to request
//     next();
//   } catch (error) {
//     console.error("Token verification failed:", error);
//     res.status(403).json({ message: "Invalid or expired token" });
//   }
// };
// module.exports = verifyFirebaseToken;
