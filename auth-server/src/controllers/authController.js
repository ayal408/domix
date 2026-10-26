import * as authService from "../services/authService.js";
import { setRefreshTokenCookie } from "../utils/cookies.js";

export async function login(req, res) {
  try {
    const result = await authService.login(req.body.userName, req.body.password);
    setRefreshTokenCookie(res, result.refreshToken);

    res.json({
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (err) {
    sendAuthError(res, err);
  }
}

export async function register(req, res) {
  try {
    const result = await authService.register(req.body);
    setRefreshTokenCookie(res, result.refreshToken);

    res.json({
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (err) {
    sendAuthError(res, err);
  }
}

export async function google(req, res) {
  try {
    const result = await authService.googleLogin(req.body.idToken);
    setRefreshTokenCookie(res, result.refreshToken);

    res.json({
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (err) {
    // Do not log provider tokens or raw HTTP request configuration.
    sendAuthError(res, err);
  }
}

export async function refresh(req, res) {
  try {
    await authService.refresh(req, res);
  } catch (err) {
    res.status(401).json({ code: err.message });
  }
}

export async function logout(req, res) {
  await authService.logout(req, res);
}

export async function verifyEmail(req, res) {
  try {
    await authService.verifyEmail(req.body.token);
    res.json({ verified: true });
  } catch (err) {
    sendAuthError(res, err);
  }
}

export async function resendVerification(req, res) {
  try {
    await authService.resendVerificationEmail(req.user.userId);
    res.json({ sent: true });
  } catch (err) {
    sendAuthError(res, err);
  }
}

export async function forgotPassword(req, res) {
  try {
    await authService.forgotPassword(req.body.email);
  } catch {
    // Swallowed deliberately — always 200, so this can't be used to enumerate registered emails.
  }
  res.json({ sent: true });
}

export async function resetPassword(req, res) {
  try {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    res.json({ reset: true });
  } catch (err) {
    sendAuthError(res, err);
  }
}
function sendAuthError(res, err) {
  if (err?.isAxiosError || err?.message === "GOOGLE_AUTH_NOT_CONFIGURED") {
    res.set("Retry-After", "3");
    return res.status(503).json({ code: "AUTH_TEMPORARILY_UNAVAILABLE" });
  }
  const allowed = new Set(["EMAIL_EXISTS", "ACCOUNT_BLOCKED", "USER_NOT_FOUND", "NO_PASSWORD_ACCOUNT",
    "INVALID_PASSWORD", "INVALID_GOOGLE_TOKEN", "INVALID_OR_EXPIRED_TOKEN", "ALREADY_VERIFIED_OR_NOT_FOUND"]);
  return res.status(400).json({ code: allowed.has(err?.message) ? err.message : "INVALID_REQUEST" });
}
