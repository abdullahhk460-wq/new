import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export type TokenAudience = 'admin' | 'user';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  /** Prevents admin JWT from being used on member routes and vice versa. */
  aud?: TokenAudience;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiration as any,
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiration as any,
  });
};


export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
};
export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
