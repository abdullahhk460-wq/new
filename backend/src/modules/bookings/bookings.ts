import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../../database/client.js';
import supabase from '../../database/supabase.js';
import { authenticate, authenticateUser } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { bookingRateLimiter } from '../../middleware/rateLimiter.js';
import { sendSuccess } from '../../utils/responses.js';
import { NotFoundError } from '../../utils/errors.js';
import { logAudit } from '../../utils/audit.js';
import {
  normalizeBookingStatus,
  isValidBookingStatus,
} from '../../utils/bookingStatus.js';

// 1. Zod Validation Schemas
const bookingSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/),
  plan: z.string().optional().nullable(),
  classType: z.string().max(100).optional().nullable(),
  timeSlot: z.string().max(50).optional().nullable(),
  comments: z.string().max(500).optional().nullable(),
});

const adminWalkInSchema = bookingSchema.extend({
  status: z
    .string()
    .optional()
    .transform((s) => normalizeBookingStatus(s ?? 'confirmed'))
    .refine(isValidBookingStatus, { message: 'Status must be pending, confirmed, or paid' }),
});

const updateBookingSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/).optional(),
  plan: z.string().optional().nullable(),
  classType: z.string().max(100).optional().nullable(),
  status: z
    .string()
    .optional()
    .transform((s) => (s === undefined ? undefined : normalizeBookingStatus(s)))
    .refine((s) => s === undefined || isValidBookingStatus(s), {
      message: 'Status must be pending, confirmed, or paid',
    }),
  cost: z.number().int().min(0).optional(),
  comments: z.string().max(500).optional().nullable(),
});

const PLAN_PRICES: Record<string, number> = {
  basic: 5000,
  standard: 8000,
  premium: 12000,
  Basic: 5000,
  Standard: 8000,
  Premium: 12000
};

// Helper to map DB snake_case record to API camelCase object
const mapBookingToCamelCase = (b: any) => ({
  id: b.id,
  name: b.name,
  email: b.email,
  phone: b.phone,
  plan: b.plan,
  classType: b.class_type,
  timeSlot: b.time_slot,
  comments: b.comments,
  status: normalizeBookingStatus(b.status),
  cost: b.cost,
  createdAt: b.created_at,
});

// 2. Controller
export const bookingsController = {
  // Public booking creation
  async createPublicBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = bookingSchema.parse(req.body);
      const planName = parsed.plan || 'Standard';
      const cost = PLAN_PRICES[planName] || 8000;

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone,
          plan: planName,
          class_type: parsed.classType,
          time_slot: parsed.timeSlot,
          comments: parsed.comments,
          status: 'pending',
          cost,
        })
        .select()
        .single();

      if (error) throw error;

      sendSuccess(res, 201, 'Booking submitted successfully', mapBookingToCamelCase(data));
    } catch (error) {
      next(error);
    }
  },

  // Admin Walk-In registration
  async createAdminWalkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = adminWalkInSchema.parse(req.body);
      const planName = parsed.plan || 'Standard';
      const cost = PLAN_PRICES[planName] || 8000;

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone,
          plan: planName,
          class_type: parsed.classType,
          time_slot: parsed.timeSlot,
          comments: parsed.comments,
          status: parsed.status,
          cost,
        })
        .select()
        .single();

      if (error) throw error;

      // Write audit log
      const admin = (req as any).admin;
      await logAudit({
        adminId: admin.id,
        action: 'booking.create',
        targetId: data.id,
        ipAddress: req.ip,
        metadata: { clientName: data.name, source: 'admin_walk_in' },
      });

      sendSuccess(res, 201, 'Walk-in client registered successfully', mapBookingToCamelCase(data));
    } catch (error) {
      next(error);
    }
  },

  // Admin list bookings
  async listBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string) || '';
      const plan = (req.query.plan as string) || '';
      const status = (req.query.status as string) || '';

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Build query
      let query = supabase
        .from('bookings')
        .select('*', { count: 'exact' });

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      if (plan && plan !== 'all') {
        query = query.ilike('plan', plan);
      }

      if (status && status !== 'all') {
        query = query.ilike('status', status);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const mappedBookings = (data || []).map(mapBookingToCamelCase);
      const totalCount = count || 0;

      sendSuccess(res, 200, 'Bookings retrieved successfully', mappedBookings, {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      });
    } catch (error) {
      next(error);
    }
  },

  // Admin update booking details or status
  async updateBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = updateBookingSchema.parse(req.body);

      // Check if booking exists
      const { data: existing, error: findError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (findError) throw findError;
      if (!existing) {
        throw new NotFoundError('Booking not found');
      }

      // Build update fields
      const updateData: any = {};
      if (parsed.name !== undefined) updateData.name = parsed.name;
      if (parsed.email !== undefined) updateData.email = parsed.email;
      if (parsed.phone !== undefined) updateData.phone = parsed.phone;
      if (parsed.plan !== undefined) updateData.plan = parsed.plan;
      if (parsed.classType !== undefined) updateData.class_type = parsed.classType;
      if (parsed.status !== undefined) updateData.status = parsed.status;
      if (parsed.cost !== undefined) updateData.cost = parsed.cost;
      if (parsed.comments !== undefined) updateData.comments = parsed.comments;

      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Write audit log
      const admin = (req as any).admin;
      await logAudit({
        adminId: admin.id,
        action: 'booking.update',
        targetId: id,
        ipAddress: req.ip,
        metadata: {
          prevStatus: existing.status,
          newStatus: updated.status,
          updatedFields: Object.keys(parsed),
        },
      });

      sendSuccess(res, 200, 'Booking updated successfully', mapBookingToCamelCase(updated));
    } catch (error) {
      next(error);
    }
  },

  // Admin delete booking
  async deleteBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Check if booking exists
      const { data: existing, error: findError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (findError) throw findError;
      if (!existing) {
        throw new NotFoundError('Booking not found');
      }

      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Write audit log
      const admin = (req as any).admin;
      await logAudit({
        adminId: admin.id,
        action: 'booking.delete',
        targetId: id,
        ipAddress: req.ip,
        metadata: { deletedName: existing.name, deletedPlan: existing.plan },
      });

      sendSuccess(res, 200, 'Booking deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  // User get their own bookings
  async listMyBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new NotFoundError('User not authenticated');
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('email', user.email)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedBookings = (data || []).map(mapBookingToCamelCase);
      sendSuccess(res, 200, 'Your bookings retrieved successfully', mappedBookings);
    } catch (error) {
      next(error);
    }
  },
};

// 3. Router configuration
const router = Router();

// Public routes
router.post('/', bookingRateLimiter, bookingsController.createPublicBooking);

// Protected admin routes
router.get('/admin', authenticate, requireRole('super_admin', 'manager'), bookingsController.listBookings);
router.post('/admin', authenticate, requireRole('super_admin', 'manager'), bookingsController.createAdminWalkIn);
router.put('/admin/:id', authenticate, requireRole('super_admin', 'manager'), bookingsController.updateBooking);
router.delete('/admin/:id', authenticate, requireRole('super_admin'), bookingsController.deleteBooking);

// Protected user routes
router.get('/my-bookings', authenticateUser, bookingsController.listMyBookings);

export default router;
