import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import DeleteAccountScreen from '@/app/delete-account';
import { deleteMyAccount } from '@/lib/account';

import { renderScreen } from '../testing/render';
import { mockRouter } from '../testing/expo-router-mock';

jest.mock('expo-router', () => require('../testing/expo-router-mock').expoRouterMock);

const mockCalls: string[] = [];
const mockRpcResult: { error: { message: string } | null } = { error: null };

jest.mock('@/lib/supabase', () => {
  const storageFor = (bucket: string) => ({
    list: jest.fn(async () => ({
      data: bucket === 'listing-images' ? [{ id: '1', name: 'a.jpg' }, { id: null, name: 'folder' }] : [],
      error: null,
    })),
    remove: jest.fn(async (paths: string[]) => {
      mockCalls.push(`remove ${bucket} ${paths.join(',')}`);
      return { data: [], error: null };
    }),
  });
  return {
    supabase: {
      storage: { from: (bucket: string) => storageFor(bucket) },
      rpc: jest.fn(async (fn: string, args: Record<string, string>) => {
        mockCalls.push(`rpc ${fn} ${args.p_confirm}`);
        return mockRpcResult;
      }),
      auth: {
        getSession: jest.fn(async () => ({ data: { session: { user: { id: 'u1', email: 'me@example.test' } } } })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
        signOut: jest.fn(async (opts: { scope: string }) => {
          mockCalls.push(`signOut ${opts.scope}`);
          return { error: null };
        }),
      },
    },
  };
});

beforeEach(() => {
  mockCalls.length = 0;
  mockRpcResult.error = null;
  jest.clearAllMocks();
});

describe('deleteMyAccount', () => {
  it('refuses without the confirmation word and changes nothing', async () => {
    await expect(deleteMyAccount('u1', 'yes')).rejects.toThrow('Please type DELETE');
    expect(mockCalls).toEqual([]);
  });

  it('removes own photos, deletes on the server, then signs out locally', async () => {
    await deleteMyAccount('u1', ' DELETE ');
    expect(mockCalls).toEqual(['remove listing-images u1/a.jpg', 'rpc mm_delete_my_account DELETE', 'signOut local']);
  });

  it('stays signed in and reports the reason if the server refuses', async () => {
    mockRpcResult.error = { message: 'Staff accounts cannot be deleted from the app.' };
    await expect(deleteMyAccount('u1', 'DELETE')).rejects.toThrow('Staff accounts');
    expect(mockCalls).not.toContain('signOut local');
  });
});

describe('Delete account screen', () => {
  it('explains what is deleted and only enables the button after typing DELETE', async () => {
    await renderScreen(<DeleteAccountScreen />);
    expect(await screen.findByText('This cannot be undone')).toBeTruthy();
    expect(screen.getByText(/Records of payments you made are kept/)).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Delete my account permanently' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account permanently' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(mockCalls).toContain('rpc mm_delete_my_account DELETE');
  });

  it('shows the server message when deletion is refused', async () => {
    mockRpcResult.error = { message: 'Staff accounts cannot be deleted from the app.' };
    await renderScreen(<DeleteAccountScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Type DELETE to confirm'), 'DELETE');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account permanently' }));
    expect(await screen.findByText(/Staff accounts cannot be deleted/)).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('support contact', () => {
  it('opens an email to the support address', async () => {
    const { Linking } = require('react-native');
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { contactSupport } = require('@/lib/support');
    await contactSupport();
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^mailto:mojeremarket\.help@gmail\.com\?subject=/));
  });
});
