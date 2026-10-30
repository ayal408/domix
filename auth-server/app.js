import dotenv from "dotenv";

// Must run before any other local import: several modules (jwt.js, authService.js,
// userClient.js) read process.env into top-level consts at import time, which — since ES
// module imports are evaluated before any statement below them — would otherwise always see
// an empty environment and silently fall back to their hardcoded defaults (including an
// insecure default JWT secret and a stale external API URL).
dotenv.config();

// A fresh install that copied .env.example verbatim (or skipped a .env) otherwise starts fine and
// then fails every request with a bare 401/403 — fail fast with the actual reason instead.
const PLACEHOLDER_SECRET = /change-me|SAME_LONG_RANDOM|THI_SHOULD_BE|ANOTHER_VERY_LONG_RANDOM/i;
for (const name of ["JWT_SECRET", "INTERNAL_SERVICE_KEY"]) {
  const value = process.env[name];
  if (!value || value.length < 32) throw new Error(`${name} must be set (in auth-server/.env) and contain at least 32 characters.`);
  if (PLACEHOLDER_SECRET.test(value)) throw new Error(`${name} still has the .env.example placeholder — set a real random value, identical in auth-server/.env and domix-server/.env.`);
}
if (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false") {
  console.warn("NODE_ENV=production: the refresh-token cookie is Secure and is only sent over HTTPS. Over plain http every refresh returns 401 — serve via HTTPS or set COOKIE_SECURE=false.");
}

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
