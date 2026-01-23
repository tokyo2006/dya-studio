/**
 * Type declarations for @cormoran/zmk-studio-react-hook mock
 */
import { Context } from 'react';

export interface DeviceInfo {
  name?: string;
  [key: string]: any;
}

export interface ZMKAppState {
  connection: any;
  deviceInfo: DeviceInfo | null;
  customSubsystems: any;
  isLoading: boolean;
  error: string | null;
}

export interface UseZMKAppReturn {
  state: ZMKAppState;
  connect: jest.Mock;
  disconnect: jest.Mock;
  findSubsystem: jest.Mock;
  isConnected: boolean;
  onNotification: jest.Mock;
}

export const useZMKApp: jest.Mock<UseZMKAppReturn>;

export const ZMKAppContext: Context<UseZMKAppReturn | null>;

export const ZMKCustomSubsystem: jest.Mock;
export const ZMKCustomSubsystemError: jest.Mock;
export const ZMKConnection: jest.Mock;
export const withTimeout: jest.Mock;
