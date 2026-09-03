import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRoutes from "./src/routes/authRoutes.js";

dotenv.config();

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
