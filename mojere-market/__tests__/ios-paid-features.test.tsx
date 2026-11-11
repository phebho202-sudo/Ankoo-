import { screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import PromoteScreen from '@/app/promote/[id]';
import { paidFeaturesOnThisDevice } from '@/lib/business';

import { renderScreen } from '../testing/render';

jest.mock('expo-router', () => require('../testing/expo-router-mock').expoRouterMock);
jest.mock('@/lib/supabase', () => ({ supabase: null }));

const original = Platform.OS;
afterEach(() => {
  Platform.OS = original;
});

it('hides paid promotions and plans on iPhone (Apple requires its own in-app purchase for them)', async () => {
  Platform.OS = 'ios';
  expect(paidFeaturesOnThisDevice()).toBe(false);
  await renderScreen(<PromoteScreen />);
  expect(screen.getByText('Promotions are not available in this version of the app.')).toBeTruthy();
});

it('keeps them on Android', () => {
  Platform.OS = 'android';
  expect(paidFeaturesOnThisDevice()).toBe(true);
});
