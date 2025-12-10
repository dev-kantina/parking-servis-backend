import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key';

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
