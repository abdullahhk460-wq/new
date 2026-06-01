import app from './app.js';
import config from './config/index.js';
import { logger } from './logs/logger.js';
import prisma from './database/client.js';
import cache from './cache/client.js';

const server = app.listen(config.port, async () => {
  logger.info(`===================================================`);
  logger.info(`  THE DEN FITNESS GYM BACKEND IS RUNNING           `);
  logger.info(`  Environment : ${config.nodeEnv}                 `);
  logger.info(`  Listening   : http://localhost:${config.port}    `);
  logger.info(`  API Docs    : http://localhost:${config.port}/api-docs `);
  logger.info(`===================================================`);

  // Verify Database connection pool
  try {
    await prisma.$connect();
    logger.info('Database connection established successfully.');
  } catch (error) {
    logger.error('Failed to connect to database during startup:', error);
    gracefulShutdown('DATABASE_FAILURE');
  }
});

// Capture Uncaught Exceptions & Rejections safely to avoid server crashes
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception occurred:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection occurred:', { reason });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Handle graceful shutdowns for DevOps environments (SIGINT, SIGTERM)
process.on('SIGTERM', () => {
  logger.warn('SIGTERM received. Starting graceful shutdown sequence...');
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  logger.warn('SIGINT received. Starting graceful shutdown sequence...');
  gracefulShutdown('SIGINT');
});

function gracefulShutdown(signal: string) {
  logger.warn(`Shutdown triggered by ${signal}. Cleaning connections...`);

  // Close express listening socket
  server.close(async () => {
    logger.info('Express server closed.');

    try {
      // Disconnect database client
      await prisma.$disconnect();
      logger.info('Database client disconnected.');
    } catch (err) {
      logger.error('Error occurred during connection cleanup:', err);
    }

    logger.info('Graceful shutdown completed. Exiting process.');
    process.exit(signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1);
  });

  // Force shutdown if cleanup hangs for more than 10 seconds
  setTimeout(() => {
    logger.error('Cleanup timed out. Forcing process exit.');
    process.exit(1);
  }, 10000).unref();
}
export default server;
