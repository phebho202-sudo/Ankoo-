import { friendlyAuthError } from '@/lib/auth';
import { profileSchema, resetPasswordSchema, signInSchema, signUpSchema, verifyCodeSchema } from '@/lib/validation';

const good = {
  displayName: '  Tolu  ',
  email: '  Tolu@Example.COM ',
  password: 'akure2026',
  confirmPassword: 'akure2026',
  acceptTerms: true,
};

describe('sign-up rules', () => {
  it('accepts valid details and tidies the email and name', () => {
    const v = signUpSchema.parse(good);
    expect(v.email).toBe('tolu@example.com');
    expect(v.displayName).toBe('Tolu');
  });
  it('requires accepting the terms', () => {
    const r = signUpSchema.safeParse({ ...good, acceptTerms: false });
    expect(r.success).toBe(false);
  });
  it('rejects weak passwords and mismatches', () => {
    expect(signUpSchema.safeParse({ ...good, password: 'short1', confirmPassword: 'short1' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...good, password: 'lettersonly', confirmPassword: 'lettersonly' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...good, password: '12345678', confirmPassword: '12345678' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...good, confirmPassword: 'different1' }).success).toBe(false);
  });
  it('rejects invalid emails', () => {
    expect(signUpSchema.safeParse({ ...good, email: 'not-an-email' }).success).toBe(false);
  });
});

describe('other forms', () => {
  it('sign-in needs an email and password', () => {
    expect(signInSchema.safeParse({ email: 'a@b.ng', password: '' }).success).toBe(false);
    expect(signInSchema.safeParse({ email: 'a@b.ng', password: 'x' }).success).toBe(true);
  });
  it('codes must be digits', () => {
    expect(verifyCodeSchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(verifyCodeSchema.safeParse({ code: '12ab56' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ code: '123456', password: 'newpass12', confirmPassword: 'newpass12' }).success).toBe(true);
  });
  it('profile requires an LGA and limits text lengths', () => {
    const base = { displayName: 'Tolu', bio: '', lgaId: '6f1c1f0e-3b7a-4c1e-9d55-2f6f0b6c9a10', townId: null, neighbourhood: '' };
    expect(profileSchema.safeParse(base).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, lgaId: '' }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, bio: 'x'.repeat(301) }).success).toBe(false);
  });
});

describe('friendly error messages', () => {
  it('translates common Supabase errors into plain language', () => {
    expect(friendlyAuthError('Invalid login credentials')).toBe('Email or password is incorrect.');
    expect(friendlyAuthError('Token has expired or is invalid')).toMatch(/code is wrong or has expired/);
    expect(friendlyAuthError('User already registered')).toMatch(/already exists/);
    expect(friendlyAuthError('email rate limit exceeded')).toMatch(/Too many attempts/);
    expect(friendlyAuthError('Error sending confirmation email')).toMatch(/could not send the email/);
  });
});
