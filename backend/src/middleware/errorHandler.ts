import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/responses.js';
import { logger } from '../logs/logger.js';
import config from '../config/index.js';
import { ZodError } from 'zod';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  // Handle Prisma Database Errors
  if (err.code && err.code.startsWith('P20')) {
    // Prisma Client errors
    if (err.code === 'P2002') {
      statusCode = 409;
      message = 'Unique constraint failed on the database.';
      errors = err.meta;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Record to update or delete not found.';
    } else {
      statusCode = 400;
      message = 'Database operation failed.';
    }
  }

  // Log Error using Winston (include stack trace in development/logs)
  logger.error(`${req.method} ${req.originalUrl} - ${statusCode} - ${message}`, {
    stack: err.stack,
    errors,
  });

  // Hiding detailed internal server error messages in production
  if (config.nodeEnv === 'production' && statusCode === 500) {
    message = 'An internal server error occurred. Please try again later.';
    errors = null;
  }

  sendError(res, statusCode, message, errors);
};

export default errorHandler;
