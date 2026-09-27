import axios from "axios";

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || "https://apartment-brokerage-wkfs.onrender.com";

// domix-server gates every one of these endpoints behind INTERNAL_SERVICE_KEY
// (see ApartmentAPI/Security/InternalOnlyAttribute.cs) — this is the only
// client in the codebase that's supposed to call them.
const client = axios.create({
  baseURL: DATA_SERVICE_URL,
  headers: { "X-Internal-Api-Key": process.env.INTERNAL_SERVICE_KEY || "" }
});

/**
 * `/api/User/lookup` only supports email/username/googleId — it has no
 * `userId` parameter, so refresh() (which only has the userId claim from the
 * refresh token) must use the by-id route instead.
 */
export async function getUserById(userId) {
  try {
    const { data } = await client.get(`/api/User/by-id/${userId}`);
    return data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

export async function lookupUser(params) {
  try {
    const { data } = await client.get(`/api/User/lookup`, { params });
    return data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * The password hash never leaves the data API — this asks it to verify the
 * password itself and reports back only the outcome. Throws an Error whose
 * message is one of USER_NOT_FOUND / NO_PASSWORD_ACCOUNT / INVALID_PASSWORD,
 * matching the codes authService.login() has always thrown.
 */
export async function verifyPassword(userName, password) {
  try {
    const { data } = await client.post(`/api/auth/verify-password`, {
      userName,
      password
    });
    return data;
  } catch (err) {
    const code = err.response?.data?.code;
    if (code) throw new Error(code);
    throw err;
  }
}

export async function createUser(payload) {
  const { data } = await client.post(`/api/User`, payload);
  return data;
}

export async function linkGoogle(userId, googleId) {
  const { data } = await client.put(`/api/User/link-google`, {
    userId,
    googleId
  });
  return data;
}

export async function linkPassword(userId, passwordHash, userName) {
  const { data } = await client.put(`/api/User/link-password`, {
    userId,
    passwordHash,
    userName
  });
  return data;
}

/**
 * Throws an Error with message INVALID_OR_EXPIRED_TOKEN on a bad/expired token,
 * matching domix-server AuthController.VerifyEmail's `{ code }` response shape.
 */
export async function verifyEmailToken(token) {
  try {
    await client.post(`/api/auth/verify-email`, { token });
  } catch (err) {
    const code = err.response?.data?.code;
    if (code) throw new Error(code);
    throw err;
  }
}

/** Throws ALREADY_VERIFIED_OR_NOT_FOUND when there's nothing to resend. */
export async function resendVerificationEmail(userId) {
  try {
    await client.post(`/api/auth/resend-verification`, { userId });
  } catch (err) {
    const code = err.response?.data?.code;
    if (code) throw new Error(code);
    throw err;
  }
}

/** Always resolves — the data API returns 200 whether or not the email matches an account. */
export async function requestPasswordReset(email) {
  await client.post(`/api/auth/forgot-password`, { email });
}

/** Throws INVALID_OR_EXPIRED_TOKEN on a bad/expired token. */
export async function resetPassword(token, passwordHash) {
  try {
    await client.post(`/api/auth/reset-password`, { token, passwordHash });
  } catch (err) {
    const code = err.response?.data?.code;
    if (code) throw new Error(code);
    throw err;
  }
}

/**
 * Records a refresh token's `jti` as revoked so it's rejected on every future /refresh call, even
 * though the JWT itself remains cryptographically valid until it naturally expires. Called from
 * logout() -- deliberately best-effort there (a failed revoke must never block the user from
 * logging out), so this is allowed to throw and the caller decides whether to swallow it.
 */
export async function revokeRefreshToken(userId, jti, expires) {
  await client.post(`/api/auth/refresh-tokens/revoke`, { userId, jti, expires });
}

export async function isRefreshTokenRevoked(jti) {
  const { data } = await client.get(`/api/auth/refresh-tokens/${jti}/revoked`);
  return data.revoked === true;
}
