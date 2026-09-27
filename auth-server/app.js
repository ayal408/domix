import dotenv from "dotenv";

// Must run before any other local import: several modules (jwt.js, authService.js,
// userClient.js) read process.env into top-level consts at import time, which — since ES
// module imports are evaluated before any statement below them — would otherwise always see
// an empty environment and silently fall back to their hardcoded defaults (including an
// insecure default JWT secret and a stale external API URL).
dotenv.config();

const { default: express } = await import("express");
const { default: cookieParser } = await import("cookie-parser");
const { default: authRoutes } = await import("./src/routes/authRoutes.js");

const app = express();

// Exactly one hop (the nginx gateway) sits in front of this service — trusting only that hop means
// `req.ip` reflects the real client IP from X-Forwarded-For, which the rate limiters below key on,
// without trusting a spoofable header from further upstream than actually exists.
app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`auth-server listening on port ${PORT}`);
});

export default app;
