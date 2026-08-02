import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.JWT_SECRET || "SUPER_SECRET_KEY_12345678910111213";
const ACCESS_TOKEN_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || "30s";
const REFRESH_TOKEN_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES || "30d";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "serverApi";
const JWT_ISSUER = process.env.JWT_ISSUER || "serverApi";
export function createAccessToken(user) {
  return jwt.sign(
    {
      userId: user.userId,
      userName: user.userName,
      email: user.emailAddress,
      googleId: user.googleId ?? null,
      aud: JWT_AUDIENCE,
      iss: JWT_ISSUER
    },
    SECRET_KEY,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES
    }
  );
}

export function createRefreshToken(user) {
  return jwt.sign(
    {
      userId: user.userId
    },
    SECRET_KEY,
    {
      expiresIn: REFRESH_TOKEN_EXPIRES
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, SECRET_KEY);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, SECRET_KEY);
}
