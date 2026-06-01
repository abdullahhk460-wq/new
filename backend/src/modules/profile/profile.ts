import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../../database/client.js';
import { authenticate, authenticateUser } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { sendSuccess } from '../../utils/responses.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';

const biometricsSchema = z.object({
  weight: z.number().min(20).max(500).optional().nullable(),
  height: z.number().min(50).max(300).optional().nullable(),
  bodyFat: z.number().min(0).max(100).optional().nullable(),
  muscleMass: z.number().min(0).max(200).optional().nullable(),
  targetWeight: z.number().min(20).max(500).optional().nullable(),
  logs: z
    .array(
      z.object({
        date: z.string().max(32),
        weight: z.number(),
        bodyFat: z.number().optional().nullable(),
        muscleMass: z.number().optional().nullable(),
      })
    )
    .max(30)
    .optional(),
});

/** Members submit rating + comment only; visibility is admin-controlled. */
const memberReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(1000),
  displayRole: z.string().max(120).optional().nullable(),
  avatarUrl: z.string().max(500).optional().nullable(),
});

const memberReviewUpdateSchema = memberReviewSchema.partial();

const adminModerationSchema = z.object({
  moderationStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  showOnWebsite: z.boolean().optional(),
});

const adminReviewEditSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().min(10).max(1000).optional(),
  displayRole: z.string().max(120).optional().nullable(),
  avatarUrl: z.string().max(500).optional().nullable(),
  moderationStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  showOnWebsite: z.boolean().optional(),
});

type BioLog = { date: string; weight: number; bodyFat?: number | null; muscleMass?: number | null };

function parseLogs(raw: string): BioLog[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapBiometrics(row: {
  weight: number | null;
  height: number | null;
  bodyFat: number | null;
  muscleMass: number | null;
  targetWeight: number | null;
  logs: string;
  updatedAt: Date;
}) {
  return {
    weight: row.weight ?? 0,
    height: row.height ?? 0,
    bodyFat: row.bodyFat ?? 0,
    muscleMass: row.muscleMass ?? 0,
    targetWeight: row.targetWeight ?? 0,
    logs: parseLogs(row.logs),
    updatedAt: row.updatedAt,
  };
}

function normalizeModerationStatus(status: string | null | undefined): 'pending' | 'approved' | 'rejected' {
  const key = String(status ?? 'pending').trim().toLowerCase();
  if (key === 'approved' || key === 'rejected') return key;
  return 'pending';
}

type MemberReviewDto = {
  id: string;
  rating: number;
  comment: string;
  displayRole: string | null;
  avatarUrl: string | null;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  showOnWebsite?: boolean;
  memberName?: string;
  memberEmail?: string;
  userId?: string;
};

function mapMemberReview(row: any, includePrivate = false): MemberReviewDto {
  const moderationStatus = normalizeModerationStatus(row.moderationStatus);

  const base: MemberReviewDto = {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    displayRole: row.displayRole,
    avatarUrl: row.avatarUrl,
    moderationStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  if (!includePrivate) return base;

  return {
    ...base,
    showOnWebsite: Boolean(row.showOnWebsite),
    memberName: row.user?.name,
    memberEmail: row.user?.email,
    userId: row.userId,
  };
}

function mapPublicTestimonial(row: any) {
  return {
    name: row.user?.name || 'Den Member',
    role: row.displayRole || (row.source === 'trainer' ? `Trainer: ${row.trainerName || 'The Den'}` : 'Member'),
    rating: row.rating,
    comment: row.comment,
    img:
      row.avatarUrl ||
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=150&h=150&q=80',
  };
}

export const profileController = {
  async getBiometrics(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      let row = await prisma.userBiometrics.findUnique({ where: { userId } });
      if (!row) {
        row = await prisma.userBiometrics.create({
          data: { userId, logs: '[]' },
        });
      }
      sendSuccess(res, 200, 'Biometrics loaded', mapBiometrics(row));
    } catch (e) {
      next(e);
    }
  },

  async saveBiometrics(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const parsed = biometricsSchema.parse(req.body);
      const logsJson = JSON.stringify(parsed.logs ?? []);

      const row = await prisma.userBiometrics.upsert({
        where: { userId },
        create: {
          userId,
          weight: parsed.weight ?? null,
          height: parsed.height ?? null,
          bodyFat: parsed.bodyFat ?? null,
          muscleMass: parsed.muscleMass ?? null,
          targetWeight: parsed.targetWeight ?? null,
          logs: logsJson,
        },
        update: {
          weight: parsed.weight ?? undefined,
          height: parsed.height ?? undefined,
          bodyFat: parsed.bodyFat ?? undefined,
          muscleMass: parsed.muscleMass ?? undefined,
          targetWeight: parsed.targetWeight ?? undefined,
          logs: parsed.logs ? logsJson : undefined,
        },
      });

      sendSuccess(res, 200, 'Biometrics saved securely', mapBiometrics(row));
    } catch (e) {
      next(e);
    }
  },

  async listMyReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const rows = await prisma.memberReview.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      sendSuccess(res, 200, 'Reviews loaded', rows.map((r) => mapMemberReview(r)));
    } catch (e) {
      next(e);
    }
  },

  async createReview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const parsed = memberReviewSchema.parse(req.body);

      const existing = await prisma.memberReview.findFirst({ where: { userId } });

      const reviewData = {
        source: 'member',
        trainerName: null,
        rating: parsed.rating,
        comment: parsed.comment,
        displayRole: parsed.displayRole || null,
        avatarUrl: parsed.avatarUrl || null,
        showOnWebsite: false,
        moderationStatus: 'pending',
      };

      const row = existing
        ? await prisma.memberReview.update({
            where: { id: existing.id },
            data: reviewData,
          })
        : await prisma.memberReview.create({
            data: { userId, ...reviewData },
          });

      sendSuccess(
        res,
        existing ? 200 : 201,
        'Review submitted for admin review',
        mapMemberReview(row)
      );
    } catch (e) {
      next(e);
    }
  },

  async updateReview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const parsed = memberReviewUpdateSchema.parse(req.body);

      const existing = await prisma.memberReview.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundError('Review not found');

      const row = await prisma.memberReview.update({
        where: { id },
        data: {
          rating: parsed.rating,
          comment: parsed.comment,
          displayRole: parsed.displayRole,
          avatarUrl: parsed.avatarUrl === '' ? null : parsed.avatarUrl,
          moderationStatus: 'pending',
          showOnWebsite: false,
        },
      });

      sendSuccess(res, 200, 'Review updated — pending admin review again', mapMemberReview(row));
    } catch (e) {
      next(e);
    }
  },

  async deleteReview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const existing = await prisma.memberReview.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundError('Review not found');
      await prisma.memberReview.delete({ where: { id } });
      sendSuccess(res, 200, 'Review deleted');
    } catch (e) {
      next(e);
    }
  },

  async publicTestimonials(_req: Request, res: Response, next: NextFunction) {
    try {
      const all = await prisma.memberReview.findMany({
        include: { user: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
      });

      const rows = all
        .filter(
          (r) =>
            normalizeModerationStatus(r.moderationStatus) === 'approved' &&
            Boolean(r.showOnWebsite)
        )
        .slice(0, 20);

      sendSuccess(res, 200, 'Testimonials loaded', rows.map(mapPublicTestimonial));
    } catch (e) {
      next(e);
    }
  },

  async adminListReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const status = ((req.query.status as string) || 'all').toLowerCase();

      const rows = await prisma.memberReview.findMany({
        include: { user: { select: { name: true, email: true } } },
        orderBy: { updatedAt: 'desc' },
      });

      const mapped = rows.map((r) => mapMemberReview(r, true));
      const filtered =
        status === 'all'
          ? mapped
          : status === 'published'
            ? mapped.filter((r) => r.moderationStatus === 'approved' && r.showOnWebsite)
            : mapped.filter((r) => r.moderationStatus === status);

      sendSuccess(res, 200, 'Reviews retrieved', filtered);
    } catch (e) {
      next(e);
    }
  },

  async adminModerateReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = adminModerationSchema.parse(req.body);

      const existing = await prisma.memberReview.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError('Review not found');

      const updateData: { moderationStatus?: string; showOnWebsite?: boolean } = {};

      if (parsed.moderationStatus) {
        updateData.moderationStatus = parsed.moderationStatus;
        if (parsed.moderationStatus === 'approved') {
          updateData.showOnWebsite = true;
        } else if (parsed.moderationStatus === 'rejected') {
          updateData.showOnWebsite = false;
        }
      }
      if (parsed.showOnWebsite !== undefined) {
        updateData.showOnWebsite = parsed.showOnWebsite;
      }

      const row = await prisma.memberReview.update({
        where: { id },
        data: updateData,
        include: { user: { select: { name: true, email: true } } },
      });

      sendSuccess(res, 200, 'Review updated', mapMemberReview(row, true));
    } catch (e) {
      next(e);
    }
  },

  async adminUpdateReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = adminReviewEditSchema.parse(req.body);

      const existing = await prisma.memberReview.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError('Review not found');

      const updateData: Record<string, unknown> = {};
      if (parsed.rating !== undefined) updateData.rating = parsed.rating;
      if (parsed.comment !== undefined) updateData.comment = parsed.comment;
      if (parsed.displayRole !== undefined) updateData.displayRole = parsed.displayRole;
      if (parsed.avatarUrl !== undefined) updateData.avatarUrl = parsed.avatarUrl || null;

      if (parsed.moderationStatus !== undefined) {
        updateData.moderationStatus = parsed.moderationStatus;
        if (parsed.moderationStatus === 'approved') {
          updateData.showOnWebsite = true;
        } else if (parsed.moderationStatus === 'rejected') {
          updateData.showOnWebsite = false;
        }
      }
      if (parsed.showOnWebsite !== undefined) {
        updateData.showOnWebsite = parsed.showOnWebsite;
        if (parsed.showOnWebsite && !parsed.moderationStatus) {
          updateData.moderationStatus = 'approved';
        }
      }

      const row = await prisma.memberReview.update({
        where: { id },
        data: updateData,
        include: { user: { select: { name: true, email: true } } },
      });

      sendSuccess(res, 200, 'Review updated', mapMemberReview(row, true));
    } catch (e) {
      next(e);
    }
  },

  async adminDeleteReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.memberReview.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError('Review not found');
      await prisma.memberReview.delete({ where: { id } });
      sendSuccess(res, 200, 'Review deleted');
    } catch (e) {
      next(e);
    }
  },
};

const router = Router();

router.get('/testimonials', profileController.publicTestimonials);

router.get(
  '/reviews/admin',
  authenticate,
  requireRole('super_admin', 'manager'),
  profileController.adminListReviews
);
router.patch(
  '/reviews/admin/:id',
  authenticate,
  requireRole('super_admin', 'manager'),
  profileController.adminModerateReview
);
router.put(
  '/reviews/admin/:id',
  authenticate,
  requireRole('super_admin', 'manager'),
  profileController.adminUpdateReview
);
router.delete(
  '/reviews/admin/:id',
  authenticate,
  requireRole('super_admin', 'manager'),
  profileController.adminDeleteReview
);

router.get('/biometrics', authenticateUser, profileController.getBiometrics);
router.put('/biometrics', authenticateUser, profileController.saveBiometrics);

router.get('/reviews', authenticateUser, profileController.listMyReviews);
router.post('/reviews', authenticateUser, profileController.createReview);
router.put('/reviews/:id', authenticateUser, profileController.updateReview);
router.delete('/reviews/:id', authenticateUser, profileController.deleteReview);

export default router;
