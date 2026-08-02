import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/login", authController.login);
router.post("/register", authController.register);
router.post("/google", authController.google);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

// Example of a protected route to verify the middleware in action
router.get("/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

export default router;