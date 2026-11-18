import { Alert, Platform } from 'react-native';

import { showAlert } from '@/lib/dialog';

const original = Platform.OS;
const originalWindow = (globalThis as { window?: unknown }).window;
afterEach(() => {
  Platform.OS = original;
  (globalThis as { window?: unknown }).window = originalWindow;
  jest.restoreAllMocks();
});

describe('showAlert', () => {
  it('uses the normal phone alert on iPhone and Android', () => {
    Platform.OS = 'android';
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    showAlert('Delete?', 'Sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete' }]);
    expect(spy).toHaveBeenCalledWith('Delete?', 'Sure?', expect.any(Array));
  });

  it('on the website, runs the action only when the person clicks OK', () => {
    Platform.OS = 'web';
    const onDelete = jest.fn();
    const onCancel = jest.fn();
    const buttons = [{ text: 'Cancel', style: 'cancel' as const, onPress: onCancel }, { text: 'Delete', onPress: onDelete }];
    (globalThis as { window?: unknown }).window = { confirm: jest.fn(() => false), alert: jest.fn() };
    showAlert('Delete?', 'Sure?', buttons);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    (globalThis as { window?: unknown }).window = { confirm: jest.fn(() => true), alert: jest.fn() };
    showAlert('Delete?', 'Sure?', buttons);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('on the website, shows a simple message box for information', () => {
    Platform.OS = 'web';
    const alert = jest.fn();
    (globalThis as { window?: unknown }).window = { confirm: jest.fn(), alert };
    showAlert('Account deleted', 'Bye');
    expect(alert).toHaveBeenCalledWith('Account deleted\n\nBye');
  });
});
