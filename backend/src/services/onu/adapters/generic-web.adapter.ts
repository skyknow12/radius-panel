import type { OnuHttpClient } from '../onu-http-client';
import type {
  OnuDeviceInformation,
  OnuOperationResult,
  OnuTestResult,
  OnuWifiConfiguration,
} from '../types';
import type { OnuAdapterSession, OnuManagementAdapter } from './types';

export class GenericWebAdapter implements OnuManagementAdapter {
  readonly adapterType = 'generic_web';
  readonly name = 'Generic Web Management Adapter';

  async testConnection(client: OnuHttpClient): Promise<{ reachable: boolean; status: number; durationMs: number; message: string }> {
    try {
      const resp = await client.request('/', { timeoutMs: 3000 });
      return {
        reachable: resp.status < 500,
        status: resp.status,
        durationMs: resp.durationMs,
        message: `HTTP endpoint reachable (${resp.status}, ${resp.durationMs}ms)`,
      };
    } catch (err: any) {
      return {
        reachable: false,
        status: 0,
        durationMs: 0,
        message: err.message || 'Web management endpoint unreachable',
      };
    }
  }

  async authenticate(client: OnuHttpClient, username: string, _password: string): Promise<OnuAdapterSession> {
    const conn = await this.testConnection(client);
    if (!conn.reachable) {
      throw new Error('Connection failed: Web management endpoint unreachable');
    }

    return {
      client,
      authenticated: true,
      username,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
  }

  async getDeviceInformation(_session: OnuAdapterSession): Promise<OnuDeviceInformation> {
    return {
      vendor: 'Generic',
      model: 'Web Terminal',
    };
  }

  async getWifiConfiguration(_session: OnuAdapterSession): Promise<OnuWifiConfiguration> {
    return {
      bands: [
        {
          band: '2.4GHz',
          ssid: 'Wi-Fi-2.4G',
          enabled: true,
        },
      ],
      clientCount: 0,
    };
  }

  async updateSSID(_session: OnuAdapterSession, _band: '2.4GHz' | '5GHz', _newSsid: string): Promise<OnuOperationResult> {
    return {
      success: false,
      verified: false,
      verificationStatus: 'not_applicable',
      message: 'Generic adapter requires custom model profile configuration to apply Wi-Fi changes',
      durationMs: 0,
    };
  }

  async updateWifiPassword(_session: OnuAdapterSession, _band: '2.4GHz' | '5GHz', _newPassword: string): Promise<OnuOperationResult> {
    return {
      success: false,
      verified: false,
      verificationStatus: 'not_applicable',
      message: 'Generic adapter requires custom model profile configuration to apply Wi-Fi changes',
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
      verificationStatus: 'not_applicable',
      message: 'Generic adapter requires model-specific adapter profile to apply Wi-Fi changes',
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
      message: 'Verification not supported by generic adapter',
    };
  }

  async testProfile(client: OnuHttpClient, username: string, password: string): Promise<OnuTestResult> {
    const startTime = Date.now();
    const conn = await this.testConnection(client);

    return {
      connection: conn.reachable,
      auth: conn.reachable,
      supportedBands: ['2.4GHz'],
      message: conn.reachable
        ? 'Generic web connection successful; requires custom model profile for full management'
        : conn.message,
      durationMs: Date.now() - startTime,
      testedCapabilities: {
        connection: conn.reachable,
        auth: conn.reachable,
        info: false,
        ssid: false,
        password: false,
        verify: false,
      },
    };
  }

  async closeSession(session: OnuAdapterSession): Promise<void> {
    session.client.clearCookies();
    session.authenticated = false;
  }
}
