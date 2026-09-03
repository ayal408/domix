import { rateLimit } from "express-rate-limit";

/**
 * Per-IP throttling for the auth endpoints — none of them had any before this. `standardHeaders`
 * exposes the RateLimit-* headers so a well-behaved client can back off gracefully; `legacyHeaders`
 * is off since nothing here relies on the deprecated X-RateLimit-* set.
 */
function limiter(windowMs, max) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: "TOO_MANY_REQUESTS" },
  });
}

// Credential guessing: tight enough to blunt brute force, loose enough that a real user mistyping
// their password a few times in a row never gets blocked.
export const loginLimiter = limiter(15 * 60 * 1000, 15);

// Account creation and Google sign-in-driven creation: spam/enumeration protection.
export const registerLimiter = limiter(60 * 60 * 1000, 8);
export const googleLimiter = limiter(15 * 60 * 1000, 15);

// Forgot-password sends a real email per request — without this, an attacker can email-bomb any
// address on file. Deliberately stricter than login/register.
export const passwordResetLimiter = limiter(60 * 60 * 1000, 5);
