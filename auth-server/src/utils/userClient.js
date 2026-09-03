import axios from "axios";

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || "https://apartment-brokerage-wkfs.onrender.com";

/**
 * `/api/User/lookup` only supports email/username/googleId — it has no
 * `userId` parameter, so refresh() (which only has the userId claim from the
 * refresh token) must use the by-id route instead.
 */
export async function getUserById(userId) {
  try {
    const { data } = await axios.get(`${DATA_SERVICE_URL}/api/User/by-id/${userId}`);
    return data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

export async function lookupUser(params) {
  try {
    const { data } = await axios.get(`${DATA_SERVICE_URL}/api/User/lookup`, {
      params
    });
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
    const { data } = await axios.post(`${DATA_SERVICE_URL}/api/auth/verify-password`, {
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
  const { data } = await axios.post(`${DATA_SERVICE_URL}/api/User`, payload);
  return data;
}

export async function linkGoogle(userId, googleId) {
  const { data } = await axios.put(`${DATA_SERVICE_URL}/api/User/link-google`, {
    userId,
    googleId
  });
  return data;
}

export async function linkPassword(userId, passwordHash, userName) {
  const { data } = await axios.put(`${DATA_SERVICE_URL}/api/User/link-password`, {
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
    await axios.post(`${DATA_SERVICE_URL}/api/auth/verify-email`, { token });
  } catch (err) {
    const code = err.response?.data?.code;
    if (code) throw new Error(code);
    throw err;
  }
}

/** Throws ALREADY_VERIFIED_OR_NOT_FOUND when there's nothing to resend. */
export async function resendVerificationEmail(userId) {
  try {
    await axios.post(`${DATA_SERVICE_URL}/api/auth/resend-verification`, { userId });
  } catch (err) {
    const code = err.response?.data?.code;
    if (code) throw new Error(code);
    throw err;
  }
}

/** Always resolves — the data API returns 200 whether or not the email matches an account. */
export async function requestPasswordReset(email) {
  await axios.post(`${DATA_SERVICE_URL}/api/auth/forgot-password`, { email });
}

/** Throws INVALID_OR_EXPIRED_TOKEN on a bad/expired token. */
export async function resetPassword(token, passwordHash) {
  try {
    await axios.post(`${DATA_SERVICE_URL}/api/auth/reset-password`, { token, passwordHash });
  } catch (err) {
    const code = err.response?.data?.code;
    if (code) throw new Error(code);
    throw err;
  }
}
