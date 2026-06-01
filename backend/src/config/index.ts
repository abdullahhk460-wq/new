import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || '/api',
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-2026-den-gym',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-token-key-2026-den-gym',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '30m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  security: {
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    csrfSecret: process.env.CSRF_SECRET || 'csrf-secret-key-for-the-den-gym-2026',
    cookieSecret: process.env.COOKIE_SECRET || 'cookie-secret-key-for-the-den-gym-2026',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    accountLockoutAttempts: parseInt(process.env.ACCOUNT_LOCKOUT_ATTEMPTS || '5', 10),
    accountLockoutDuration: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MINUTES || '15', 10) * 60 * 1000, // in ms
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
};
export default config;
