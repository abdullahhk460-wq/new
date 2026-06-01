import { Router } from 'express';
import { z } from 'zod';
import authController from './controller.js';
import userAuthController from './userController.js';
import { authenticate, authenticateUser } from '../../middleware/authenticate.js';
import { authRateLimiter, refreshRateLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

// ── Validation middleware ──────────────────────────────────────────────────────
const validate = (schema: z.ZodSchema) => (req: any, res: any, next: any) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      status: 'fail',
      message: 'Validation failed',
      errors: result.error.flatten().fieldErrors,
    });
  }
  req.body = result.data;
  next();
};

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const signupUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ── Admin Auth Routes ─────────────────────────────────────────────────────────

/** GET /api/auth/csrf — CSRF token for admin + member dashboards */
router.get('/csrf', authController.csrf);

/** POST /api/auth/login */
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);

/** POST /api/auth/logout  (requires auth) */
router.post('/logout', authenticate, authController.logout);

/** POST /api/auth/refresh — silently rotate tokens */
router.post('/refresh', refreshRateLimiter, authController.refresh);

/** GET /api/auth/me — check session validity */
router.get('/me', authenticate, authController.me);

/** POST /api/auth/forgot-password */
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);

/** POST /api/auth/reset-password */
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);


// ── Regular User Auth Routes ──────────────────────────────────────────────────

/** POST /api/auth/user/signup */
router.post('/user/signup', authRateLimiter, validate(signupUserSchema), userAuthController.signup);

/** POST /api/auth/user/login */
router.post('/user/login', authRateLimiter, validate(loginSchema), userAuthController.login);

/** POST /api/auth/user/logout */
router.post('/user/logout', authenticateUser, userAuthController.logout);

/** POST /api/auth/user/refresh */
router.post('/user/refresh', refreshRateLimiter, userAuthController.refresh);

/** GET /api/auth/user/me */
router.get('/user/me', authenticateUser, userAuthController.me);

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const changePasswordUserSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

/** PUT /api/auth/user/profile */
router.put('/user/profile', authenticateUser, validate(updateProfileSchema), userAuthController.updateProfile);

/** PUT /api/auth/user/password */
router.put('/user/password', authenticateUser, validate(changePasswordUserSchema), userAuthController.changePassword);

export default router;
