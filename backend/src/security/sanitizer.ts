import { Request, Response, NextFunction } from 'express';

// Recursively sanitizes dynamic strings to protect against XSS injections
export const sanitizeString = (val: string): string => {
  if (typeof val !== 'string') return val;
  return val
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // Strip script tags
    .replace(/on\w+="[^"]*"/g, '') // Strip inline JS handlers
    .replace(/javascript:[^\s]*/gi, '') // Strip protocol-based JS URLs
    .trim();
};

export const sanitizeObject = (obj: any): any => {
  if (!obj) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
};

// Express Middleware to sanitize input fields
export const sanitizeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
};
export default sanitizeMiddleware;
