import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '@/app/(tabs)/index';
import ProfileScreen from '@/app/(tabs)/profile';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

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
  it('disables the connection test until Supabase is configured', async () => {
    await wrap(<ProfileScreen />);
    const button = screen.getByRole('button', { name: 'Test Supabase connection' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Ondo State LGAs loaded: 18')).toBeTruthy();
  });
});
