import type { OnuHttpClient } from '../onu-http-client';
import type {
  OnuDeviceInformation,
  OnuOperationResult,
  OnuTestResult,
  OnuWifiConfiguration,
} from '../types';

export interface OnuAdapterSession {
  client: OnuHttpClient;
  authenticated: boolean;
  username: string;
  token?: string;
  sessionId?: string;
  expiresAt?: number;
}

export interface OnuManagementAdapter {
  readonly adapterType: string;
  readonly name: string;

  /**
   * Test network reachability of ONU web management interface
   */
  testConnection(client: OnuHttpClient): Promise<{ reachable: boolean; status: number; durationMs: number; message: string }>;

  /**
   * Authenticate against ONU web management interface
   */
  authenticate(client: OnuHttpClient, username: string, password: string): Promise<OnuAdapterSession>;

  /**
   * Retrieve hardware, firmware, and runtime information
   */
  getDeviceInformation(session: OnuAdapterSession): Promise<OnuDeviceInformation>;

  /**
   * Retrieve 2.4 GHz and 5 GHz Wi-Fi settings
   */
  getWifiConfiguration(session: OnuAdapterSession): Promise<OnuWifiConfiguration>;

  /**
   * Update Wi-Fi SSID
   */
  updateSSID(session: OnuAdapterSession, band: '2.4GHz' | '5GHz', newSsid: string): Promise<OnuOperationResult>;

  /**
   * Update Wi-Fi WPA PreSharedKey password
   */
  updateWifiPassword(session: OnuAdapterSession, band: '2.4GHz' | '5GHz', newPassword: string): Promise<OnuOperationResult>;

  /**
   * Combined Wi-Fi update (SSID and/or password) with post-apply verification
   */
  applyWifiConfiguration(
    session: OnuAdapterSession,
    params: {
      band: '2.4GHz' | '5GHz';
      ssid?: string;
      password?: string;
    }
  ): Promise<OnuOperationResult>;

  /**
   * Verify that applied Wi-Fi configuration matches desired state
   */
  verifyConfiguration(
    session: OnuAdapterSession,
    expected: {
      band: '2.4GHz' | '5GHz';
      ssid?: string;
    }
  ): Promise<{ verified: boolean; message: string }>;

  /**
   * Run complete capability suite for profile testing
   */
  testProfile(client: OnuHttpClient, username: string, password: string): Promise<OnuTestResult>;

  /**
   * Safely terminate management session
   */
  closeSession(session: OnuAdapterSession): Promise<void>;
}
