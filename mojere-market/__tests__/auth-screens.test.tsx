import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import ForgotPasswordScreen from '@/app/auth/forgot-password';
import SignInScreen from '@/app/auth/sign-in';
import SignUpScreen from '@/app/auth/sign-up';
import VerifyEmailScreen from '@/app/auth/verify-email';

import { mockRouter, setMockParams } from '../testing/expo-router-mock';
import { renderScreen } from '../testing/render';

jest.mock('expo-router', () => require('../testing/expo-router-mock').expoRouterMock);

// A stand-in Supabase client: we check what the app asks Supabase to do.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      verifyOtp: jest.fn(),
      resend: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
    },
  },
  checkSupabaseConnection: jest.fn(),
}));
const mockAuth = require('@/lib/supabase').supabase.auth as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.getSession!.mockResolvedValue({ data: { session: null } });
  mockAuth.onAuthStateChange!.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  setMockParams({});
});

async function type(label: string, text: string) {
  await fireEvent.changeText(screen.getByLabelText(label), text);
}

describe('Sign up', () => {
  it('shows helpful errors and does not contact Supabase when the form is empty', async () => {
    await renderScreen(<SignUpScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Enter your email address.')).toBeTruthy();
    expect(screen.getByText(/must accept the Terms/)).toBeTruthy();
    expect(mockAuth.signUp).not.toHaveBeenCalled();
  });

  it('creates the account and asks for the email code', async () => {
    mockAuth.signUp!.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null });
    await renderScreen(<SignUpScreen />);
    await type('Your name', 'Tolu');
    await type('Email address', ' Tolu@Example.com ');
    await type('Password', 'akure2026');
    await type('Type the password again', 'akure2026');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I accept the Terms and Privacy Policy' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(mockAuth.signUp).toHaveBeenCalledTimes(1));
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'tolu@example.com',
      password: 'akure2026',
      options: { data: { display_name: 'Tolu', terms_accepted: 'true' } },
    });
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/auth/verify-email',
      params: { email: 'tolu@example.com' },
    });
  });

  it('explains when the email is already registered', async () => {
    mockAuth.signUp!.mockResolvedValue({ data: { session: null }, error: { message: 'User already registered' } });
    await renderScreen(<SignUpScreen />);
    await type('Your name', 'Tolu');
    await type('Email address', 'tolu@example.com');
    await type('Password', 'akure2026');
    await type('Type the password again', 'akure2026');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I accept the Terms and Privacy Policy' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/already exists/)).toBeTruthy();
  });
});

describe('Log in', () => {
  it('shows a plain message for a wrong password', async () => {
    mockAuth.signInWithPassword!.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });
    await renderScreen(<SignInScreen />);
    await type('Email address', 'tolu@example.com');
    await type('Password', 'wrongpass1');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();
  });

  it('sends unconfirmed users to enter their email code', async () => {
    mockAuth.signInWithPassword!.mockResolvedValue({ data: {}, error: { message: 'Email not confirmed' } });
    await renderScreen(<SignInScreen />);
    await type('Email address', 'tolu@example.com');
    await type('Password', 'akure2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/auth/verify-email', params: { email: 'tolu@example.com' } }),
    );
  });

  it('goes to the profile after a successful login', async () => {
    mockAuth.signInWithPassword!.mockResolvedValue({ data: { session: {} }, error: null });
    await renderScreen(<SignInScreen />);
    await type('Email address', 'tolu@example.com');
    await type('Password', 'akure2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(mockRouter.navigate).toHaveBeenCalledWith('/profile'));
  });
});

describe('Email code', () => {
  it('verifies the code for the right email', async () => {
    setMockParams({ email: 'tolu@example.com' });
    mockAuth.verifyOtp!.mockResolvedValue({ data: {}, error: null });
    await renderScreen(<VerifyEmailScreen />);
    await type('Code from the email', '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm email' }));
    await waitFor(() =>
      expect(mockAuth.verifyOtp).toHaveBeenCalledWith({ email: 'tolu@example.com', token: '123456', type: 'email' }),
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith('/edit-profile');
  });

  it('makes people wait before requesting another code', async () => {
    setMockParams({ email: 'tolu@example.com' });
    await renderScreen(<VerifyEmailScreen />);
    const resend = screen.getByRole('button', { name: /Send a new code in/ });
    expect(resend.props.accessibilityState.disabled).toBe(true);
  });
});

describe('Forgot password', () => {
  it('sends a code, then sets the new password', async () => {
    mockAuth.resetPasswordForEmail!.mockResolvedValue({ data: {}, error: null });
    mockAuth.verifyOtp!.mockResolvedValue({ data: {}, error: null });
    mockAuth.updateUser!.mockResolvedValue({ data: {}, error: null });
    await renderScreen(<ForgotPasswordScreen />);
    await type('Email address', 'tolu@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset code' }));
    await waitFor(() => expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('tolu@example.com'));

    await type('Code from the email', '654321');
    await type('New password', 'newpass2026');
    await type('Type the new password again', 'newpass2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Save new password' }));
    await waitFor(() => expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'newpass2026' }));
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({ email: 'tolu@example.com', token: '654321', type: 'recovery' });
  });
});
