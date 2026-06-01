import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

interface RequestWithAdmin extends Request {
  admin?: {
    id: string;
    email: string;
    role: string;
  };
}

export const requireRole = (...allowedRoles: string[]) => {
  return (req: RequestWithAdmin, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

export default requireRole;
