import type { OnuHttpClient } from '../onu-http-client';
import type {
  OnuDeviceInformation,
  OnuOperationResult,
  OnuTestResult,
  OnuWifiConfiguration,
} from '../types';
import type { OnuAdapterSession, OnuManagementAdapter } from './types';

export class UnsupportedAdapter implements OnuManagementAdapter {
  readonly adapterType = 'unsupported';
  readonly name = 'Unsupported / Unconfigured Adapter';

  private message: string;

  constructor(message = 'Detected, but management adapter requires configuration.') {
    this.message = message;
  }

  async testConnection(client: OnuHttpClient): Promise<{ reachable: boolean; status: number; durationMs: number; message: string }> {
    try {
      const resp = await client.request('/', { timeoutMs: 3000 });
      return {
        reachable: resp.status < 500,
        status: resp.status,
        durationMs: resp.durationMs,
        message: this.message,
      };
    } catch (err: any) {
      return {
        reachable: false,
        status: 0,
        durationMs: 0,
        message: err.message || 'Target unreachable',
      };
    }
  }

  async authenticate(_client: OnuHttpClient, _username: string, _password: string): Promise<OnuAdapterSession> {
    throw new Error(this.message);
  }

  async getDeviceInformation(_session: OnuAdapterSession): Promise<OnuDeviceInformation> {
    return {
      vendor: 'Unknown',
      model: 'Unknown',
    };
  }

  async getWifiConfiguration(_session: OnuAdapterSession): Promise<OnuWifiConfiguration> {
    return {
      bands: [],
    };
  }

  async updateSSID(_session: OnuAdapterSession, _band: '2.4GHz' | '5GHz', _newSsid: string): Promise<OnuOperationResult> {
    return {
      success: false,
      verified: false,
      verificationStatus: 'failed',
      message: this.message,
      durationMs: 0,
    };
  }

  async updateWifiPassword(_session: OnuAdapterSession, _band: '2.4GHz' | '5GHz', _newPassword: string): Promise<OnuOperationResult> {
    return {
      success: false,
      verified: false,
      verificationStatus: 'failed',
      message: this.message,
      durationMs: 0,
    };
  }

  async applyWifiConfiguration(
    _session: OnuAdapterSession,
    _params: {
      band: '2.4GHz' | '5GHz';
      ssid?: string;
      password?: string;
    }
  ): Promise<OnuOperationResult> {
    return {
      success: false,
      verified: false,
      verificationStatus: 'failed',
      message: this.message,
      durationMs: 0,
    };
  }

  async verifyConfiguration(
    _session: OnuAdapterSession,
    _expected: {
      band: '2.4GHz' | '5GHz';
      ssid?: string;
    }
  ): Promise<{ verified: boolean; message: string }> {
    return {
      verified: false,
      message: this.message,
    };
  }

  async testProfile(_client: OnuHttpClient, _username: string, _password: string): Promise<OnuTestResult> {
    return {
      connection: false,
      auth: false,
      supportedBands: [],
      message: this.message,
      durationMs: 0,
      testedCapabilities: {
        connection: false,
        auth: false,
        info: false,
        ssid: false,
        password: false,
        verify: false,
      },
    };
  }

  async closeSession(_session: OnuAdapterSession): Promise<void> {}
}
