import { Request, Response, NextFunction } from 'express';
import userAuthService from './userService.js';
import { sendSuccess } from '../../utils/responses.js';
import { sessionCookieOptions } from '../../utils/cookies.js';

interface RequestWithUser extends Request {
  user?: { id: string; email: string; name: string };
}

const setTokenCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const cookieBase = { ...sessionCookieOptions, path: '/' };

  res.cookie('user_access_token', accessToken, {
    ...cookieBase,
    maxAge: 30 * 60 * 1000,
  });

  res.cookie('user_refresh_token', refreshToken, {
    ...cookieBase,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearTokenCookies = (res: Response) => {
  res.clearCookie('user_access_token', sessionCookieOptions);
  res.clearCookie('user_refresh_token', sessionCookieOptions);
};

export const userAuthController = {
  /** POST /auth/user/signup */
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      await userAuthService.signup(req.body);
      const loginResult = await userAuthService.login({
        email: req.body.email,
        password: req.body.password,
      });
      setTokenCookies(res, loginResult.accessToken, loginResult.refreshToken);
      sendSuccess(res, 201, 'Signup successful', {
        user: loginResult.user,
        accessToken: loginResult.accessToken,
      });
    } catch (error) {
      next(error);
    }
  },

  /** POST /auth/user/login */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await userAuthService.login(req.body);
      setTokenCookies(res, result.accessToken, result.refreshToken);
      sendSuccess(res, 200, 'Login successful', {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  },

  /** POST /auth/user/logout */
  async logout(req: RequestWithUser, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.user_refresh_token;
      if (refreshToken) {
        await userAuthService.logout(refreshToken);
      }
      clearTokenCookies(res);
      sendSuccess(res, 200, 'Logout successful');
    } catch (error) {
      next(error);
    }
  },

  /** POST /auth/user/refresh */
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.user_refresh_token || req.body?.refreshToken;
      const result = await userAuthService.refresh(refreshToken);
      setTokenCookies(res, result.accessToken, result.refreshToken);
      sendSuccess(res, 200, 'Token refreshed successfully', {
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  },

  /** GET /auth/user/me */
  async me(req: RequestWithUser, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      sendSuccess(res, 200, 'Session active', { user });
    } catch (error) {
      next(error);
    }
  },

  /** PUT /auth/user/profile */
  async updateProfile(req: RequestWithUser, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await userAuthService.updateProfile(userId, req.body);
      sendSuccess(res, 200, 'Profile updated successfully', result);
    } catch (error) {
      next(error);
    }
  },

  /** PUT /auth/user/password */
  async changePassword(req: RequestWithUser, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      await userAuthService.changePassword(userId, req.body);
      clearTokenCookies(res); // Clear session cookies to force re-login
      sendSuccess(res, 200, 'Password changed successfully. Please log in again.');
    } catch (error) {
      next(error);
    }
  },
};

export default userAuthController;
