import { z } from 'zod';

/**
 * Form rules, checked on the phone before anything is sent.
 * The database enforces the same limits again on the server.
 */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address.')
  .email('Enter a valid email address, e.g. name@gmail.com.');

const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.');

const displayName = z
  .string()
  .trim()
  .min(2, 'Your name must be at least 2 characters.')
  .max(60, 'Your name must be at most 60 characters.');

export const signUpSchema = z
  .object({
    displayName,
    email,
    password,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v, 'You must accept the Terms and Privacy Policy to continue.'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match.',
  });
export type SignUpValues = z.input<typeof signUpSchema>;

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});
export type SignInValues = z.input<typeof signInSchema>;

export const emailOnlySchema = z.object({ email });
export type EmailOnlyValues = z.input<typeof emailOnlySchema>;

const code = z
  .string()
  .trim()
  .regex(/^\d{6,10}$/, 'Enter the code from the email (numbers only).');

export const verifyCodeSchema = z.object({ code });
export type VerifyCodeValues = z.input<typeof verifyCodeSchema>;

export const resetPasswordSchema = z
  .object({ code, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match.',
  });
export type ResetPasswordValues = z.input<typeof resetPasswordSchema>;

export const profileSchema = z.object({
  displayName,
  bio: z.string().trim().max(300, 'Keep your bio under 300 characters.'),
  lgaId: z.string().uuid('Choose your local government area.'),
  townId: z.string().uuid().nullable(),
  neighbourhood: z.string().trim().max(80, 'Keep this under 80 characters.'),
});
export type ProfileValues = z.input<typeof profileSchema>;
