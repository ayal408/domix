import bcrypt from "bcryptjs";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import {
    createAccessToken,
    createRefreshToken,
    verifyRefreshToken
} from "../utils/jwt.js";
import { mapUser } from "../utils/mapper.js";
import {
  lookupUser,
  createUser,
  linkGoogle,
  verifyPassword,
  getUserById,
  verifyEmailToken,
  resendVerificationEmail as resendVerificationEmailApi,
  requestPasswordReset,
  resetPassword as resetPasswordApi
} from "../utils/userClient.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generateUsername(email) {
  return `${email.split("@")[0]}_${Date.now()}`;
}

/**
 * Google's ID token only carries a `picture` URL, but the data API stores avatars as raw bytes
 * (see UserService.CreateUserAsync's ProfileImageBase64) — fetches it once, at account creation,
 * so new Google sign-ins get their real photo instead of the generated identicon fallback.
 * Returns null (not throws) on any failure so a slow/unreachable photo never blocks sign-in.
 */
async function fetchGooglePictureBase64(pictureUrl) {
  if (!pictureUrl) return null;
  try {
    const { data } = await axios.get(pictureUrl, { responseType: "arraybuffer", timeout: 5000 });
    return Buffer.from(data).toString("base64");
  } catch {
    return null;
  }
}

export async function login(userName, password) {
  // The data API verifies the password itself and never returns the hash —
  // see domix-server AuthController.VerifyPassword. It also rejects blocked
  // accounts before ever checking the password (VerifyPasswordOutcome.Blocked).
  const user = await verifyPassword(userName, password);

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  return {
    user: mapUser(user),
    accessToken,
    refreshToken
  };
}

export async function register({ userName, email, password, phone }) {
  const existing = await lookupUser({ email });

  if (existing) throw new Error("EMAIL_EXISTS");

const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10));
  const user = await createUser({
    userName,
    emailAddress: email,
    phoneNumber: phone,
    passwordHash,
    registrationMethod: "Password"
  });

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  return {
    user: mapUser(user),
    accessToken,
    refreshToken
  };
}

export async function googleLogin(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();

  if (!payload?.email || !payload?.sub) {
    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  let user = await lookupUser({
    email: payload.email,
    googleId: payload.sub
  });

  if (user && !user.googleId) {
    user = await linkGoogle(user.userId, payload.sub);
  }

  if (!user) {
    const profileImageBase64 = await fetchGooglePictureBase64(payload.picture);
    user = await createUser({
      emailAddress: payload.email,
      googleId: payload.sub,
      userName: generateUsername(payload.email),
      passwordHash: null,
      registrationMethod: "Google",
      profileImageBase64
    });
  } else if (user.isBlocked) {
    throw new Error("ACCOUNT_BLOCKED");
  }

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  return {
    user: mapUser(user),
    accessToken,
    refreshToken
  };
}

export async function refresh(req, res) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.sendStatus(401);
  }

  try {
    const payload = verifyRefreshToken(refreshToken);

    const user = await getUserById(payload.userId);

    if (!user || user.isBlocked) {
      return res.sendStatus(401);
    }

    const accessToken = createAccessToken(user);

    res.json({
      accessToken
    });
  } catch {
    res.sendStatus(401);
  }
}

export function logout(req, res) {
  res.clearCookie("refreshToken");
  res.sendStatus(204);
}

export async function verifyEmail(token) {
  await verifyEmailToken(token);
}

export async function resendVerificationEmail(userId) {
  await resendVerificationEmailApi(userId);
}

export async function forgotPassword(email) {
  await requestPasswordReset(email);
}

export async function resetPassword(token, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10));
  await resetPasswordApi(token, passwordHash);
}
