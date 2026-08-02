import * as authService from "../services/authService.js";

export async function login(req, res) {
  try {
    const result = await authService.login(req.body.userName, req.body.password);
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.COOKIE_SAME_SITE || "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (err) {
    res.status(400).json({ code: err.message });
  }
}

export async function register(req, res) {
  try {
    const result = await authService.register(req.body);
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.COOKIE_SAME_SITE || "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (err) {
    res.status(400).json({ code: err.message });
  }
}

export async function google(req, res) {
  try {
    const result = await authService.googleLogin(req.body.idToken);
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.COOKIE_SAME_SITE || "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (err) {
    res.status(400).json({ code: err.message });
  }
}

export async function refresh(req, res) {
  try {
    await authService.refresh(req, res);
  } catch (err) {
    res.status(401).json({ code: err.message });
  }
}

export function logout(req, res) {
  authService.logout(req, res);
}