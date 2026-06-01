import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/responses.js';
import { securityLogger } from '../logs/logger.js';
import config from '../config/index.js';

const isDev = config.nodeEnv !== 'production';

// Global API rate limiter — relaxed in development
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    securityLogger.warn(`Global Rate Limit breached by IP: ${req.ip}`, { ip: req.ip, url: req.originalUrl });
    sendError(res, 429, 'Too many requests. Please slow down and try again in a few minutes.');
  },
});

// Login/signup only — refresh/me are not rate-limited here
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    securityLogger.warn(`Auth Rate Limit breached by IP: ${req.ip}`, { ip: req.ip, email: req.body?.email });
    sendError(res, 429, 'Too many login attempts. Please try again in a few minutes.');
  },
});

/** Soft limit for token refresh (prevents refresh storms) */
export const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 30 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, 429, 'Too many session refresh attempts. Please wait one minute.');
  },
});

// Booking endpoint rate limiter (10 submissions per minute per IP)
export const bookingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    securityLogger.warn(`Booking Rate Limit breached by IP: ${req.ip}`);
    sendError(res, 429, 'Too many booking requests. Please try again in a minute.');
  },
});

// Contact form rate limiter (5 submissions per 10 minutes per IP)
export const contactRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    securityLogger.warn(`Contact Rate Limit breached by IP: ${req.ip}`);
    sendError(res, 429, 'Too many messages sent. Please try again after 10 minutes.');
  },
});
