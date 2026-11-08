// Shared test helper: a stand-in for expo-router navigation.
import type { ReactNode } from 'react';
import { Text } from 'react-native';

export const mockRouter = {
  navigate: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  setParams: jest.fn(),
  dismissAll: jest.fn(),
  canDismiss: jest.fn(() => false),
  canGoBack: jest.fn(() => false),
};

export let mockParams: Record<string, string> = {};
export function setMockParams(p: Record<string, string>) {
  mockParams = p;
}

export const expoRouterMock = {
  router: mockRouter,
  useLocalSearchParams: () => mockParams,
  Link: ({ children }: { children: ReactNode }) => <Text>{children}</Text>,
};
