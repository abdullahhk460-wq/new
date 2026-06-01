import express from 'express';
import config from './config/index.js';
import applySecurityMiddleware from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './utils/errors.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';

// Feature Routers
import authRouter from './modules/auth/routes.js';
import bookingsRouter from './modules/bookings/bookings.js';
import contactRouter from './modules/contact/contact.js';
import auditLogsRouter from './modules/audit-logs/auditLogs.js';
import profileRouter from './modules/profile/profile.js';
import settingsRouter from './modules/settings/settings.js';

const app = express();

// 1. Apply security middleware (helmet, CORS, cookieParser, body parsers)
applySecurityMiddleware(app);

// 2. Global rate limiter (applied to all routes)
app.use(globalRateLimiter);

// 3. Health check (bypasses auth)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 4. Feature Routers
app.use(`${config.apiPrefix}/auth`, authRouter);
app.use(`${config.apiPrefix}/bookings`, bookingsRouter);
app.use(`${config.apiPrefix}/contact`, contactRouter);
app.use(`${config.apiPrefix}/audit-logs`, auditLogsRouter);
app.use(`${config.apiPrefix}/profile`, profileRouter);
app.use(`${config.apiPrefix}/settings`, settingsRouter);

// 5. Handle unmatched routes
app.use('*', (req, _res, next) => {
  next(new NotFoundError(`Resource not found: ${req.method} ${req.originalUrl}`));
});

// 6. Global error handler
app.use(errorHandler);

export default app;
export { app };
