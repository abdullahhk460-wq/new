import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from '../config/index.js';
import { ForbiddenError } from '../utils/errors.js';
import { securityLogger } from '../logs/logger.js';
import { csrfCookieOptions } from '../utils/cookies.js';

export function createCsrfToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie('XSRF-TOKEN', token, csrfCookieOptions);
}

function normalizePath(url: string): string {
  const pathOnly = url.split('?')[0].toLowerCase().replace(/\/$/, '') || '/';
  return pathOnly;
}

// Custom double-submit cookie CSRF validation middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  const normalizedPath = normalizePath(req.originalUrl || req.path);

  // Safe methods do not require CSRF verification
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (!req.cookies['XSRF-TOKEN']) {
      setCsrfCookie(res, createCsrfToken());
    }
    return next();
  }

  // Login/signup/refresh: no session yet or token rotation without readable cross-origin cookie
  const exemptPaths = [
    '/api/bookings',
    '/api/contact',
    '/api/auth/csrf',
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/user/signup',
    '/api/auth/user/login',
    '/api/auth/user/refresh',
    '/api/profile/testimonials',
    '/api/settings/public',
  ];

  if (exemptPaths.includes(normalizedPath)) {
    return next();
  }

  const cookieToken = req.cookies['XSRF-TOKEN'];
  const headerToken = req.headers['x-xsrf-token'] || req.body?._csrf;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    securityLogger.warn(`CSRF Attack Blocked: IP ${req.ip} tried to modify resource without valid token`, {
      ip: req.ip,
      url: req.originalUrl,
      method: req.method,
    });
    return next(new ForbiddenError('Invalid or missing CSRF token'));
  }

  next();
};

export const applySecurityMiddleware = (app: Express): void => {
  // 1. Helmet Headers for standard security
  app.use(helmet());

  // 2. Configure CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [config.security.corsOrigin];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        // Allow all localhost origins in development
        if (config.nodeEnv !== 'production') {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-xsrf-token'],
    })
  );

  // 3. Parse Cookies (essential for HTTPOnly JWT storage)
  app.use(cookieParser(config.security.cookieSecret));

  // 4. Rate Limiting request payloads (max 10kb to avoid DoS attacks)
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // 5. CSRF Protection Middleware
  app.use(csrfProtection);
};

export default applySecurityMiddleware;
