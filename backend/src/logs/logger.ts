import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.resolve(__dirname, '../../logs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `[${timestamp}] ${level}: ${message}`;
    if (Object.keys(metadata).length > 0 && level.indexOf('error') >= 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// 1. General Application Logger
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'den-gym-backend' },
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'rejections.log') }),
  ],
});

// 2. Security Events Logger (failed logins, blockages, CSRF/Rate limit breaches)
export const securityLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'security-monitor' },
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'security.log') }),
  ],
});

// 3. Audit Ledger Logger (financial transactions, DB modifications, role changes)
export const auditLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'audit-ledger' },
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'audit.log') }),
  ],
});

// Add console output in non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: consoleFormat }));
  securityLogger.add(new winston.transports.Console({ format: consoleFormat }));
  auditLogger.add(new winston.transports.Console({ format: consoleFormat }));
}
export default logger;
