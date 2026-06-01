import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../../database/client.js';
import supabase from '../../database/supabase.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { contactRateLimiter } from '../../middleware/rateLimiter.js';
import { sendSuccess } from '../../utils/responses.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { logAudit } from '../../utils/audit.js';
import { securityLogger } from '../../logs/logger.js';

// ── Validation Schemas ────────────────────────────────────────────────────────

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email format'),
  subject: z.string().max(150).optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
  // Honeypot: bots will fill this, humans won't see it
  website: z.string().max(0, 'Spam detected').optional(),
});

// Helper to map DB snake_case to camelCase
const mapContactToCamelCase = (c: any) => ({
  id: c.id,
  name: c.name,
  email: c.email,
  subject: c.subject,
  message: c.message,
  honeypot: c.honeypot,
  createdAt: c.created_at,
});

// ── Controller ────────────────────────────────────────────────────────────────

export const contactController = {
  /** POST /api/contact — public, rate-limited, honeypot protected */
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError('Validation failed', parsed.error.flatten().fieldErrors);
      }

      const { name, email, subject, message, website } = parsed.data;

      // Honeypot check — if 'website' has any value, silently discard (bot detected)
      if (website && website.length > 0) {
        securityLogger.warn(`Honeypot triggered on contact form. IP: ${req.ip}`, {
          ip: req.ip,
          email,
        });
        // Return a fake success so bots don't know they were rejected
        return sendSuccess(res, 200, 'Your message has been received. We will be in touch soon!');
      }

      const { error } = await supabase
        .from('contact_inquiries')
        .insert({
          name,
          email,
          subject: subject || null,
          message,
          honeypot: null,
        });

      if (error) throw error;

      sendSuccess(res, 201, 'Your message has been received. We will be in touch soon!');
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/contact/admin — admin list all inquiries */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string) || '';
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('contact_inquiries')
        .select('*', { count: 'exact' });

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,subject.ilike.%${search}%,message.ilike.%${search}%`);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const mappedInquiries = (data || []).map(mapContactToCamelCase);
      const totalCount = count || 0;

      sendSuccess(res, 200, 'Inquiries retrieved successfully', mappedInquiries, {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      });
    } catch (error) {
      next(error);
    }
  },

  /** DELETE /api/contact/admin/:id — admin delete inquiry */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const { data: existing, error: findError } = await supabase
        .from('contact_inquiries')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (findError) throw findError;
      if (!existing) {
        throw new NotFoundError('Contact inquiry not found');
      }

      const { error: deleteError } = await supabase
        .from('contact_inquiries')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      const admin = (req as any).admin;
      await logAudit({
        adminId: admin?.id,
        action: 'contact.delete',
        targetId: id,
        ipAddress: req.ip,
        metadata: { deletedFrom: existing.email },
      });

      sendSuccess(res, 200, 'Inquiry deleted successfully');
    } catch (error) {
      next(error);
    }
  },
};

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router();

// Public route — rate-limited
router.post('/', contactRateLimiter, contactController.submit);

// Protected admin routes
router.get('/admin', authenticate, requireRole('super_admin', 'manager'), contactController.list);
router.delete('/admin/:id', authenticate, requireRole('super_admin', 'manager'), contactController.delete);

export default router;
