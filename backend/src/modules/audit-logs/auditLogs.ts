import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../database/client.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { sendSuccess } from '../../utils/responses.js';

const router = Router();

/** GET /api/audit-logs — super_admin only */
router.get(
  '/',
  authenticate,
  requireRole('super_admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const search = (req.query.search as string) || '';
      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { action: { contains: search, mode: 'insensitive' } },
          { ipAddress: { contains: search } },
          { admin: { email: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const [logs, totalCount] = await prisma.$transaction([
        prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            admin: { select: { id: true, email: true, role: true } },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      sendSuccess(res, 200, 'Audit logs retrieved successfully', logs, {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
