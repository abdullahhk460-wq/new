import { Request, Response, NextFunction } from 'express';
import authService from './service.js';
import { sendSuccess } from '../../utils/responses.js';
import { sessionCookieOptions } from '../../utils/cookies.js';
import { createCsrfToken, setCsrfCookie } from '../../middleware/security.js';

interface RequestWithAdmin extends Request {
  admin?: { id: string; email: string; role: string };
}

const setTokenCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const cookieBase = { ...sessionCookieOptions, path: '/' };

  res.cookie('access_token', accessToken, {
    ...cookieBase,
    maxAge: 30 * 60 * 1000,
  });

  res.cookie('refresh_token', refreshToken, {
    ...cookieBase,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearTokenCookies = (res: Response) => {
  res.clearCookie('access_token', sessionCookieOptions);
  res.clearCookie('refresh_token', sessionCookieOptions);
};

export const authController = {
  /** GET /auth/csrf — issue CSRF token for SPA (cross-origin safe) */
  async csrf(req: Request, res: Response) {
    const token = req.cookies?.['XSRF-TOKEN'] || createCsrfToken();
    setCsrfCookie(res, token);
    sendSuccess(res, 200, 'CSRF token issued', { csrfToken: token });
  },

  /** POST /auth/login */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      setTokenCookies(res, result.accessToken, result.refreshToken);

      // Return user info + accessToken (client may not support cookies in dev)
      sendSuccess(res, 200, 'Login successful', {
        admin: result.admin,
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  },

  /** POST /auth/logout */
  async logout(req: RequestWithAdmin, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.refresh_token;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      clearTokenCookies(res);
      sendSuccess(res, 200, 'Logout successful');
    } catch (error) {
      next(error);
    }
  },

  /** POST /auth/refresh */
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
      const result = await authService.refresh(refreshToken);

      setTokenCookies(res, result.accessToken, result.refreshToken);
      sendSuccess(res, 200, 'Token refreshed successfully', {
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  },

  /** GET /auth/me */
  async me(req: RequestWithAdmin, res: Response, next: NextFunction) {
    try {
      const admin = req.admin!;
      sendSuccess(res, 200, 'Session active', { admin });
    } catch (error) {
      next(error);
    }
  },

  /** POST /auth/forgot-password */
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      await authService.forgotPassword(email);
      // Always return success to prevent email enumeration
      sendSuccess(res, 200, 'If that email exists, a reset link has been sent.');
    } catch (error) {
      next(error);
    }
  },

  /** POST /auth/reset-password */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword(token, newPassword);
      sendSuccess(res, 200, 'Password reset successfully. Please log in.');
    } catch (error) {
      next(error);
    }
  },
};

export default authController;
