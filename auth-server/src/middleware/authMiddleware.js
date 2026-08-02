import { verifyAccessToken } from "../utils/jwt.js";

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "NO_TOKEN" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }
}