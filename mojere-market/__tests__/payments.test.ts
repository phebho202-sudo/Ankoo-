import {
  parseChargeSuccess,
  parseInitializeRequest,
  safeEqual,
  verifyPaystackSignature,
} from '../supabase/functions/_shared/paystack';
import { slugify, toWhatsAppNumber } from '@/lib/business';
import { businessSchema } from '@/lib/validation';

// Node's built-in crypto, used here to create genuine test signatures.
const nodeCrypto = require('node:crypto') as {
  createHmac: (alg: string, key: string) => { update: (d: string) => { digest: (enc: 'hex') => string } };
  webcrypto: Crypto;
};
const { createHmac, webcrypto } = nodeCrypto;

// The test environment may not provide Web Crypto; Supabase's servers do.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const SECRET = 'sk_test_example_not_real';
const body = JSON.stringify({ event: 'charge.success', data: { reference: 'MM-1', amount: 100000, currency: 'NGN', status: 'success' } });
const goodSignature = createHmac('sha512', SECRET).update(body).digest('hex');

describe('Paystack webhook signature', () => {
  it('accepts a genuine Paystack signature', async () => {
    await expect(verifyPaystackSignature(body, goodSignature, SECRET)).resolves.toBe(true);
  });
  it('rejects a missing or forged signature', async () => {
    await expect(verifyPaystackSignature(body, null, SECRET)).resolves.toBe(false);
    await expect(verifyPaystackSignature(body, 'abc123', SECRET)).resolves.toBe(false);
    await expect(verifyPaystackSignature(body, createHmac('sha512', 'wrong-key').update(body).digest('hex'), SECRET)).resolves.toBe(false);
  });
  it('rejects a body that was changed after signing (e.g. a bigger amount)', async () => {
    const tampered = body.replace('100000', '1');
    await expect(verifyPaystackSignature(tampered, goodSignature, SECRET)).resolves.toBe(false);
  });
  it('compares safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('Payment requests from the app', () => {
  const id = '6f1c1f0e-3b7a-4c1e-9d55-2f6f0b6c9a10';
  it('accepts only known purposes and ids', () => {
    expect(parseInitializeRequest({ purpose: 'promotion', targetId: id })).toEqual({ purpose: 'promotion', targetId: id });
    expect(parseInitializeRequest({ purpose: 'refund', targetId: id })).toBeNull();
    expect(parseInitializeRequest({ purpose: 'promotion', targetId: "x'; drop table" })).toBeNull();
    expect(parseInitializeRequest(null)).toBeNull();
  });
  it('ignores any price the app tries to send', () => {
    expect(parseInitializeRequest({ purpose: 'promotion', targetId: id, amount: 1 })).toEqual({ purpose: 'promotion', targetId: id });
  });
  it('reads Paystack charge.success events and ignores others', () => {
    expect(parseChargeSuccess(JSON.parse(body))).toEqual({ reference: 'MM-1', amount: 100000, currency: 'NGN', status: 'success' });
    expect(parseChargeSuccess({ event: 'transfer.success', data: {} })).toBeNull();
    expect(parseChargeSuccess({ event: 'charge.success', data: { reference: 'x', amount: '100' } })).toBeNull();
  });
});

describe('Business helpers', () => {
  it('makes web names', () => {
    expect(slugify('Akure Gadgets & Co.')).toBe('akure-gadgets-and-co');
    expect(slugify('  Mama Tolu’s Kitchen  ')).toBe('mama-tolu-s-kitchen');
  });
  it('formats Nigerian numbers for WhatsApp', () => {
    expect(toWhatsAppNumber('0803 123 4567')).toBe('2348031234567');
    expect(toWhatsAppNumber('+234 803 123 4567')).toBe('2348031234567');
  });
  it('validates the business form', () => {
    const good = {
      name: 'Akure Gadgets', slug: 'akure-gadgets', description: '', categoryId: null,
      contactPhone: '0803 123 4567', contactEmail: '', whatsapp: '', lgaId: '6f1c1f0e-3b7a-4c1e-9d55-2f6f0b6c9a10', townId: null,
    };
    expect(businessSchema.safeParse(good).success).toBe(true);
    expect(businessSchema.safeParse({ ...good, slug: 'Bad Slug!' }).success).toBe(false);
    expect(businessSchema.safeParse({ ...good, contactEmail: 'not-an-email' }).success).toBe(false);
    expect(businessSchema.safeParse({ ...good, contactPhone: 'call me' }).success).toBe(false);
  });
});
