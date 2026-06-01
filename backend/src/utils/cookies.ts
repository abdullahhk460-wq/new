import config from '../config/index.js';

/** Cookie options for cross-origin SPA dev (Vite :5173 → API :5000). */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: (config.nodeEnv === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
};

export const csrfCookieOptions = {
  httpOnly: false,
  secure: config.nodeEnv === 'production',
  sameSite: (config.nodeEnv === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
};
