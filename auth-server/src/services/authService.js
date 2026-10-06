import bcrypt from "bcryptjs";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import {
    createAccessToken,
    createRefreshToken,
    verifyRefreshToken
} from "../utils/jwt.js";
import { mapUser } from "../utils/mapper.js";
import { setRefreshTokenCookie } from "../utils/cookies.js";
import {
  lookupUser,
  createUser,
  linkGoogle,
  verifyPassword,
  getUserById,
  verifyEmailToken,
  resendVerificationEmail as resendVerificationEmailApi,
  requestPasswordReset,
  resetPassword as resetPasswordApi,
  revokeRefreshToken,
  isRefreshTokenRevoked
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

export async function register({ userName, email, password, phone, languagePreference }) {
  const existing = await lookupUser({ email });

  if (existing) throw new Error("EMAIL_EXISTS");

const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10));
  const user = await createUser({
    userName,
    emailAddress: email,
    phoneNumber: phone,
    languagePreference,
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

    // A signature/expiry check alone can't catch a token the user already logged out of --
    // that's exactly what this revocation check is for (see revokeRefreshToken in logout()).
    if (payload.jti && (await isRefreshTokenRevoked(payload.jti))) {
      return res.sendStatus(401);
    }

    const user = await getUserById(payload.userId);

    if (!user || user.isBlocked) {
      return res.sendStatus(401);
    }

    const accessToken = createAccessToken(user);

    // Rotation: the old refresh token is revoked the moment it's used, and a brand new one takes
    // its place in the cookie. This bounds how long a stolen-but-unused refresh token stays
    // usable to a single access-token lifetime instead of its full 30-day life, and (bonus) means
    // a copy of an already-rotated token failing this same revocation check is a strong signal of
    // theft, not just an expected user action.
    const newRefreshToken = createRefreshToken(user);
    if (payload.jti) {
      try {
        await revokeRefreshToken(payload.userId, payload.jti, new Date(payload.exp * 1000));
      } catch {
        // Best-effort, same as logout(): a user must still be able to refresh their session even
        // if domix-server is briefly unreachable. Worst case, the old token stays usable until it
        // expires on its own rather than being cut off the instant it's rotated.
      }
    }
    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      accessToken
    });
  } catch {
    res.sendStatus(401);
  }
}

export async function logout(req, res) {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      if (payload.jti) {
        // Best-effort: a user must always be able to log out client-side (cookie cleared below)
        // even if domix-server is briefly unreachable -- losing server-side revocation for one
        // logout is a far smaller problem than blocking logout entirely.
        await revokeRefreshToken(payload.userId, payload.jti, new Date(payload.exp * 1000));
      }
    } catch {
      // Expired/malformed refresh token -- nothing meaningful to revoke, and the cookie is
      // cleared unconditionally below regardless.
    }
  }

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

