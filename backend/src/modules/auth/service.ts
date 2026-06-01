import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../../database/client.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { BadRequestError, UnauthorizedError, ForbiddenError } from '../../utils/errors.js';
import { securityLogger } from '../../logs/logger.js';
import config from '../../config/index.js';

const MAX_FAILED_ATTEMPTS = config.security.accountLockoutAttempts;
const LOCKOUT_DURATION_MS = config.security.accountLockoutDuration;

export const authService = {
  /**
   * Login with email/password. Returns signed JWT access + refresh tokens.
   * Enforces account lockout on repeated failures.
   */
  async login(
    credentials: { email: string; password: string },
    metadata: { ipAddress?: string; userAgent?: string }
  ) {
    const { email, password } = credentials;

    // 1. Find admin user
    const user = await prisma.adminUser.findUnique({ where: { email } });

    // Always verify a hash to prevent timing oracle leaking whether email exists
    const dummyHash = '$2b$12$invalidhash000000000000000000000000000000000000000000000';
    const hashToVerify = user?.passwordHash ?? dummyHash;

    // 2. Check lockout BEFORE comparing password
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMins = Math.ceil(remainingMs / 60000);
      securityLogger.warn(`Locked account login attempt: ${email}`, { ip: metadata.ipAddress });
      throw new UnauthorizedError(
        `Account is locked. Try again in ${remainingMins} minute${remainingMins !== 1 ? 's' : ''}.`
      );
    }

    // 3. Compare password
    const isPasswordValid = await bcrypt.compare(password, hashToVerify);

    if (!user || !isPasswordValid) {
      if (user) {
        // Increment failed attempts
        const newAttempts = user.failedLoginAttempts + 1;
        const isNowLocked = newAttempts >= MAX_FAILED_ATTEMPTS;

        await prisma.adminUser.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newAttempts,
            lockedUntil: isNowLocked ? new Date(Date.now() + LOCKOUT_DURATION_MS) : undefined,
          },
        });

        securityLogger.warn(`Failed login for ${email} (attempt ${newAttempts})`, { ip: metadata.ipAddress });
      }

      throw new UnauthorizedError('Invalid email or password');
    }

    // 4. Successful login — reset lockout counters
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      },
    });

    // 5. Issue tokens
    const tokenPayload = { userId: user.id, email: user.email, role: user.role, aud: 'admin' as const };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // 6. Store hashed refresh token in DB
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        adminId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    securityLogger.info(`Successful login: ${email}`, { userId: user.id, ip: metadata.ipAddress });

    return {
      admin: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    };
  },

  /** Revoke the current refresh token on logout */
  async logout(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revoked: false },
      data: { revoked: true },
    });
  },

  /**
   * Refresh Token Rotation (RTR).
   * If a revoked token is reused, all tokens for that admin are revoked (theft detection).
   */
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const dbToken = await prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { admin: true },
    });

    // RTR Theft Detection: token was already used/revoked
    if (dbToken?.revoked) {
      // Revoke ALL tokens for this admin (session hijacking detected)
      await prisma.refreshToken.updateMany({
        where: { adminId: dbToken.adminId, revoked: false },
        data: { revoked: true },
      });

      securityLogger.error(
        `SECURITY: Revoked refresh token reuse detected for admin ${dbToken.adminId}. All sessions revoked.`
      );

      throw new ForbiddenError('Security breach detected. Please log in again.');
    }

    // Verify JWT signature
    let decoded: any;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Refresh token is expired or invalid');
    }

    if (!dbToken || dbToken.adminId !== decoded.userId || dbToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: dbToken.id },
      data: { revoked: true },
    });

    // Issue new tokens
    const admin = dbToken.admin;
    if (!admin) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    const tokenPayload = { userId: admin.id, email: admin.email, role: admin.role, aud: 'admin' as const };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    await prisma.refreshToken.create({
      data: {
        adminId: admin.id,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  /** Initiate password reset flow — generate time-limited token */
  async forgotPassword(email: string) {
    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user) return; // Silently ignore to prevent email enumeration

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { resetToken, resetExpires },
    });

    // TODO: send email with resetToken link (requires email service)
    securityLogger.info(`Password reset token generated for: ${email}`);
  },

  /** Complete password reset — verify token, update hash */
  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.adminUser.findFirst({
      where: {
        resetToken: token,
        resetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestError('Password reset token is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, config.security.bcryptSaltRounds);

    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetExpires: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Revoke all refresh tokens on password change (force re-login everywhere)
    await prisma.refreshToken.updateMany({
      where: { adminId: user.id, revoked: false },
      data: { revoked: true },
    });

    securityLogger.info(`Password reset completed for: ${user.email}`);
  },
};

export default authService;
