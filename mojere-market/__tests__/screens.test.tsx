import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderScreen } from '../testing/render';

import HomeScreen from '@/app/(tabs)/index';
import ProfileScreen from '@/app/(tabs)/profile';

jest.mock('expo-router', () => require('../testing/expo-router-mock').expoRouterMock);

const wrap = renderScreen;

describe('Home screen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the brand, tagline and an honest setup notice', async () => {
    await wrap(<HomeScreen />);
    expect(screen.getAllByLabelText('Mojere Market').length).toBeGreaterThan(0);
    expect(screen.getByText('Turn unused into useful.')).toBeTruthy();
    expect(screen.getByText('Not connected to the database yet')).toBeTruthy();
  });

  it('Sell and Declutter buttons go to the Sell tab', async () => {
    await wrap(<HomeScreen />);
    await fireEvent.press(screen.getByText('Sell an Item'));
    await fireEvent.press(screen.getByText('Declutter My Home'));
    expect(router.navigate).toHaveBeenCalledTimes(2);
    expect(router.navigate).toHaveBeenCalledWith('/sell');
  });

  it('category tiles open Explore filtered by that category', async () => {
    await wrap(<HomeScreen />);
    await fireEvent.press(screen.getByLabelText('Browse Furniture'));
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/explore', params: { category: 'furniture' } });
  });
});

describe('Profile screen', () => {
  it('shows sign-up options when nobody is signed in, disabled until Supabase is set up', async () => {
    await wrap(<ProfileScreen />);
    const create = screen.getByRole('button', { name: 'Create an account' });
    expect(create.props.accessibilityState.disabled).toBe(true);
  });

  it('disables the connection test until Supabase is configured', async () => {
    await wrap(<ProfileScreen />);
    const button = screen.getByRole('button', { name: 'Test Supabase connection' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Ondo State LGAs loaded: 18')).toBeTruthy();
  });
});
