import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

// Fail fast if JWT secrets are not configured
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Application cannot start without proper JWT configuration.');
}

if (!JWT_REFRESH_SECRET) {
  throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is not set. Application cannot start without proper JWT configuration.');
}

// Validate that secrets are strong enough (at least 32 characters)
if (JWT_SECRET.length < 32) {
  console.warn('WARNING: JWT_SECRET should be at least 32 characters for security. Current length:', JWT_SECRET.length);
}

if (JWT_REFRESH_SECRET.length < 32) {
  console.warn('WARNING: JWT_REFRESH_SECRET should be at least 32 characters for security. Current length:', JWT_REFRESH_SECRET.length);
}

// Vrijeme u sekundama
const JWT_EXPIRE_SECONDS = 7 * 24 * 60 * 60; // 7 dana
const JWT_REFRESH_EXPIRE_SECONDS = 30 * 24 * 60 * 60; // 30 dana

export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: JWT_EXPIRE_SECONDS });
};

export const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload as object, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRE_SECONDS });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
};
