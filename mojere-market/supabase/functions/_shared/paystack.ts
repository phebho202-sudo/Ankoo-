// Shared Paystack helpers for Mojere Market's server functions.
// Plain TypeScript using the standard Web Crypto API, so it runs on
// Supabase Edge Functions (Deno) and in the app's automated tests.

export const PAYSTACK_API = 'https://api.paystack.co';

export type Purpose = 'promotion' | 'business_subscription';

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Compare two strings without leaking timing information. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Paystack signs every webhook with HMAC-SHA512 of the raw request body,
 * using your secret key, and sends it in the `x-paystack-signature` header.
 * Anything without a valid signature is rejected.
 */
export async function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
  secretKey: string,
): Promise<boolean> {
  if (!signature || !secretKey) return false;
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const mac = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  return safeEqual(toHex(mac), signature.trim().toLowerCase());
}

/** Validate what the app asks to pay for. Prices are NEVER taken from the request. */
export function parseInitializeRequest(body: unknown): { purpose: Purpose; targetId: string } | null {
  if (!body || typeof body !== 'object') return null;
  const { purpose, targetId } = body as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if ((purpose !== 'promotion' && purpose !== 'business_subscription') || typeof targetId !== 'string' || !uuid.test(targetId)) {
    return null;
  }
  return { purpose, targetId };
}

export type ChargeEvent = { reference: string; amount: number; currency: string; status: string };

/** Pull the fields we need out of a Paystack `charge.success` event. */
export function parseChargeSuccess(payload: unknown): ChargeEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { event?: unknown; data?: Record<string, unknown> };
  if (p.event !== 'charge.success' || !p.data) return null;
  const { reference, amount, currency, status } = p.data;
  if (typeof reference !== 'string' || typeof amount !== 'number' || typeof currency !== 'string') return null;
  return { reference, amount, currency, status: typeof status === 'string' ? status : '' };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
