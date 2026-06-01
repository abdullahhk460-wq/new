import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';
import prisma from '../database/client.js';
import { securityLogger } from '../logs/logger.js';

interface RequestWithAdmin extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  admin?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = async (
  req: RequestWithAdmin,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | null = null;

    // 1. Try to extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Try to extract token from HttpOnly cookies if header is empty
    if (!token && req.cookies) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return next(new UnauthorizedError('Access token is missing or invalid'));
    }

    // 3. Verify JWT
    let decoded: any;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      return next(new UnauthorizedError('Access token has expired or is invalid'));
    }

    const { userId } = decoded;

    if (decoded.aud && decoded.aud !== 'admin') {
      return next(new UnauthorizedError('Invalid admin session'));
    }

    // 4. Fetch admin user from Database
    const user = await prisma.adminUser.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return next(new UnauthorizedError('User session no longer exists'));
    }

    // 5. Security check (locked account)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return next(new UnauthorizedError('This account is temporarily locked'));
    }

    // 6. Inject admin details into the request
    const adminPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    req.user = adminPayload;
    req.admin = adminPayload;

    next();
  } catch (error) {
    securityLogger.error('Authentication middleware failure:', error);
    next(new UnauthorizedError('Authentication failed'));
  }
};

export const authenticateUser = async (
  req: any,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | null = null;

    // 1. Try to extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Try to extract token from HttpOnly cookies if header is empty
    if (!token && req.cookies) {
      token = req.cookies.user_access_token;
    }

    if (!token) {
      return next(new UnauthorizedError('Access token is missing or invalid'));
    }

    // 3. Verify JWT
    let decoded: any;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      return next(new UnauthorizedError('Access token has expired or is invalid'));
    }

    const { userId } = decoded;

    if (decoded.aud && decoded.aud !== 'user') {
      return next(new UnauthorizedError('Invalid member session'));
    }

    // 4. Fetch regular user from Database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return next(new UnauthorizedError('User session no longer exists'));
    }

    // 5. Inject user details into the request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    next();
  } catch (error) {
    securityLogger.error('User authentication middleware failure:', error);
    next(new UnauthorizedError('Authentication failed'));
  }
};

export default authenticate;
