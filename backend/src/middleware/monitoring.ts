import { Request, Response, NextFunction } from 'express';
import { logger } from '../logs/logger.js';
import prisma from '../database/client.js';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// 1. Request Monitoring Middleware
export const requestMonitor = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime();
  
  // Intercept the response writing to capture size
  const originalWrite = res.write;
  const originalEnd = res.end;
  let responseSize = 0;

  const chunks: any[] = [];
  
  res.write = function (chunk: any) {
    chunks.push(chunk);
    return originalWrite.apply(res, arguments as any);
  };

  res.end = function (chunk: any) {
    if (chunk) chunks.push(chunk);
    const body = Buffer.concat(chunks.map(c => typeof c === 'string' ? Buffer.from(c) : c));
    responseSize = body.length;
    return originalEnd.apply(res, arguments as any);
  };

  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6; // Convert to ms
    
    const logDetails = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: durationMs.toFixed(2),
      responseSize,
      ip: req.ip,
      userAgent: req.get('user-agent') || 'unknown',
    };

    // Log general request details
    if (res.statusCode >= 500) {
      logger.error(`Request Failed: ${req.method} ${req.originalUrl}`, logDetails);
    } else if (res.statusCode >= 400) {
      logger.warn(`Request Warn: ${req.method} ${req.originalUrl}`, logDetails);
    } else {
      logger.info(`Request Completed: ${req.method} ${req.originalUrl}`, logDetails);
    }

    // Capture system performance anomaly (e.g. latency > 2000ms)
    if (durationMs > 2000) {
      logger.warn(`Slow Request Detected: ${req.method} ${req.originalUrl} took ${durationMs}ms`);
    }
  });

  next();
};

// 2. Audit Trail Middleware for mutations (POST, PUT, DELETE, PATCH)
export const auditTrail = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  let responseBody: any;

  res.send = function (body: any) {
    responseBody = body;
    return originalSend.apply(res, arguments as any);
  };

  res.on('finish', async () => {
    // Record only mutation methods and successful transactions
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
    
    // Ignore authentication paths like login/logout in explicit audit tables
    // (since they have their own security logs or authentication logs)
    const isAuthPath = req.originalUrl.includes('/auth/login') || req.originalUrl.includes('/auth/register');

    if (isMutation && isSuccess && !isAuthPath) {
      try {
        const adminId = req.user?.id || null;
        let details: string | null = null;

        if (req.body && Object.keys(req.body).length > 0) {
          // Sensitive fields mask
          const sanitizedBody = { ...req.body };
          const sensitiveFields = ['password', 'passwordConfirm', 'token', 'refreshToken', 'cardNumber'];
          sensitiveFields.forEach(field => {
            if (sanitizedBody[field]) sanitizedBody[field] = '********';
          });
          details = JSON.stringify(sanitizedBody);
        }

        // Determine Entity and Action based on URL
        const pathParts = req.originalUrl.split('?')[0].split('/');
        const entity = pathParts[2] || 'unknown'; // assuming /api/v1/entity/id or /api/entity/id
        
        let action = `${req.method}_${entity.toUpperCase()}`;
        
        // Save to Database Audit Log
        await prisma.auditLog.create({
          data: {
            adminId,
            action,
            ipAddress: req.ip,
            metadata: JSON.stringify({
              entity,
              details,
              userAgent: req.get('user-agent') || 'unknown',
            })
          },
        });
      } catch (error) {
        logger.error('Failed to write audit trail log to database:', error);
      }
    }
  });

  next();
};

