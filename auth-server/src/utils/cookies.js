const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // matches REFRESH_TOKEN_EXPIRES' default (30d)

/** Shared by every place that issues a refresh token (login/register/google/refresh) so the cookie's options never drift between them. */
export function setRefreshTokenCookie(res, refreshToken) {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.COOKIE_SAME_SITE || "strict",
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS
  });
}
