/**
 * Mock for @cormoran/zmk-studio-react-hook module
 */
import { createContext } from 'react';

export const useZMKApp = jest.fn(() => ({
  state: {
    connection: null,
    deviceInfo: null,
    customSubsystems: null,
    isLoading: false,
    error: null,
  },
  connect: jest.fn(),
  disconnect: jest.fn(),
  findSubsystem: jest.fn(),
  isConnected: false,
  onNotification: jest.fn(),
}));

export const ZMKAppContext = createContext<any>(null);

export const ZMKCustomSubsystem = jest.fn();
export const ZMKCustomSubsystemError = jest.fn();
export const ZMKConnection = jest.fn();
export const withTimeout = jest.fn();
