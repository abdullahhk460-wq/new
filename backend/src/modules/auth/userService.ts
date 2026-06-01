import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../../database/client.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { BadRequestError, UnauthorizedError, ForbiddenError } from '../../utils/errors.js';
import { securityLogger } from '../../logs/logger.js';
import config from '../../config/index.js';

export const userAuthService = {
  /**
   * Register a new regular user.
   */
  async signup(data: { email: string; password: string; name: string }) {
    const { email, password, name } = data;

    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new BadRequestError('Email is already registered');
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, config.security.bcryptSaltRounds);

    // 3. Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  },

  /**
   * Log in regular user. Returns signed JWT access + refresh tokens.
   */
  async login(credentials: { email: string; password: string }) {
    const { email, password } = credentials;

    // 1. Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 2. Compare password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 3. Issue tokens
    const tokenPayload = { userId: user.id, email: user.email, role: 'user', aud: 'user' as const };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // 4. Store hashed refresh token in DB
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    securityLogger.info(`Successful user login: ${email}`, { userId: user.id });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
    };
  },

  /** Revoke current refresh token on user logout */
  async logout(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revoked: false },
      data: { revoked: true },
    });
  },

  /**
   * Refresh token rotation for regular users.
   */
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const dbToken = await prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    // RTR Theft Detection: token was already used/revoked
    if (dbToken?.revoked) {
      // Revoke ALL tokens for this user
      await prisma.refreshToken.updateMany({
        where: { userId: dbToken.userId, revoked: false },
        data: { revoked: true },
      });

      securityLogger.error(
        `SECURITY: Revoked refresh token reuse detected for user ${dbToken.userId}. All sessions revoked.`
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

    if (!dbToken || dbToken.userId !== decoded.userId || dbToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: dbToken.id },
      data: { revoked: true },
    });

    // Issue new tokens
    const user = dbToken.user!;
    const tokenPayload = { userId: user.id, email: user.email, role: 'user', aud: 'user' as const };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  /** Update regular user profile details */
  async updateProfile(userId: string, data: { name: string }) {
    const { name } = data;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { name },
    });
    return { id: user.id, email: user.email, name: user.name };
  },

  /** Change regular user password */
  async changePassword(userId: string, data: { oldPassword?: string; newPassword?: string }) {
    const { oldPassword, newPassword } = data;
    if (!oldPassword || !newPassword) {
      throw new BadRequestError('Old password and new password are required');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestError('Invalid old password');
    }

    const passwordHash = await bcrypt.hash(newPassword, config.security.bcryptSaltRounds);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke all existing sessions/tokens for this user to force re-login
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  },
};

export default userAuthService;
