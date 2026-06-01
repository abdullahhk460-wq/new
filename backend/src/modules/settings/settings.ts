import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../../database/client.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { sendSuccess } from '../../utils/responses.js';

const SETTINGS_ID = 'main';

const DEFAULT_WHATSAPP_MSG =
  'Assalam-o-Alaikum, I want to book an elite trial workout pass at The Den Gym!';

/** Accept 923..., 03..., spaces, dashes — normalize before validation. */
export function normalizeWhatsAppNumber(raw: unknown): string {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';

  // Pakistan local: 03169636282 → 923169636282
  if (digits.startsWith('0') && digits.length >= 10) {
    digits = `92${digits.slice(1)}`;
  } else if (digits.length === 10 && digits.startsWith('3')) {
    digits = `92${digits}`;
  }

  return digits;
}

const updateSettingsSchema = z.object({
  whatsappNumber: z.preprocess(
    (val) => normalizeWhatsAppNumber(val),
    z
      .string()
      .min(10, 'WhatsApp number must be at least 10 digits (e.g. 03169636282 or 923169636282)')
      .max(15, 'WhatsApp number is too long')
  ),
  whatsappPrefillMessage: z.preprocess((val) => {
    const text = typeof val === 'string' ? val.trim() : '';
    return text.length >= 3 ? text : DEFAULT_WHATSAPP_MSG;
  }, z.string().min(3).max(500)),
});

async function getOrCreateSettings() {
  let row = await prisma.siteSetting.findUnique({ where: { id: SETTINGS_ID } });
  if (!row) {
    row = await prisma.siteSetting.create({ data: { id: SETTINGS_ID } });
  }
  return row;
}

function mapSettings(row: { whatsappNumber: string; whatsappPrefillMessage: string; updatedAt: Date }) {
  const digits = normalizeWhatsAppNumber(row.whatsappNumber);
  return {
    whatsappNumber: digits,
    whatsappDisplay: digits.startsWith('92') ? `0${digits.slice(2)}` : digits,
    whatsappPrefillMessage: row.whatsappPrefillMessage || DEFAULT_WHATSAPP_MSG,
    updatedAt: row.updatedAt,
  };
}

export const settingsController = {
  async getPublic(_req: Request, res: Response, next: NextFunction) {
    try {
      const row = await getOrCreateSettings();
      sendSuccess(res, 200, 'Settings loaded', mapSettings(row));
    } catch (e) {
      next(e);
    }
  },

  async getAdmin(_req: Request, res: Response, next: NextFunction) {
    try {
      const row = await getOrCreateSettings();
      sendSuccess(res, 200, 'Settings loaded', mapSettings(row));
    } catch (e) {
      next(e);
    }
  },

  async updateAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updateSettingsSchema.parse(req.body);
      const digits = normalizeWhatsAppNumber(parsed.whatsappNumber);

      if (!digits || digits.length < 10) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid WhatsApp number',
          errors: [{ field: 'whatsappNumber', message: 'Enter a valid mobile number' }],
        });
      }

      const row = await prisma.siteSetting.upsert({
        where: { id: SETTINGS_ID },
        create: {
          id: SETTINGS_ID,
          whatsappNumber: digits,
          whatsappPrefillMessage: parsed.whatsappPrefillMessage,
        },
        update: {
          whatsappNumber: digits,
          whatsappPrefillMessage: parsed.whatsappPrefillMessage,
        },
      });

      sendSuccess(res, 200, 'WhatsApp settings updated', mapSettings(row));
    } catch (e) {
      next(e);
    }
  },
};

const router = Router();

router.get('/public', settingsController.getPublic);
router.get('/admin', authenticate, requireRole('super_admin', 'manager'), settingsController.getAdmin);
router.put('/admin', authenticate, requireRole('super_admin', 'manager'), settingsController.updateAdmin);

export default router;
