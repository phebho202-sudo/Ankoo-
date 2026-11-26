'use strict';
const path = require('node:path');

const env = process.env;
const DB_PATH = env.DB_PATH || path.join(__dirname, '..', 'data', 'store.db');

module.exports = {
  port: Number(env.PORT || 3000),
  baseUrl: (env.BASE_URL || '').replace(/\/$/, ''),
  production: env.NODE_ENV === 'production',
  trustProxy: env.TRUST_PROXY === '1',
  dbPath: DB_PATH,
  uploadDir: env.UPLOAD_DIR || path.join(path.dirname(DB_PATH), 'uploads'),
  adminEmails: String(env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  paystackSecret: env.PAYSTACK_SECRET_KEY || '',
  resendKey: env.RESEND_API_KEY || '',
  mailFrom: env.MAIL_FROM || '',
  orderNotifyEmail: env.ORDER_NOTIFY_EMAIL || '',
  whatsapp: {
    token: env.WHATSAPP_TOKEN || '',
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
    appSecret: env.WHATSAPP_APP_SECRET || '',
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || '',
  },
  instagramToken: env.INSTAGRAM_ACCESS_TOKEN || '',
  gaId: env.GA_MEASUREMENT_ID || '',
  metaPixelId: env.META_PIXEL_ID || '',
  gscVerification: env.GOOGLE_SITE_VERIFICATION || '',
};
