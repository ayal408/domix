import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { loginLimiter, registerLimiter, googleLimiter, passwordResetLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.post("/login", loginLimiter, authController.login);
router.post("/register", registerLimiter, authController.register);
router.post("/google", googleLimiter, authController.google);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authMiddleware, authController.resendVerification);
router.post("/forgot-password", passwordResetLimiter, authController.forgotPassword);
router.post("/reset-password", passwordResetLimiter, authController.resetPassword);

// Example of a protected route to verify the middleware in action
router.get("/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

export default router;