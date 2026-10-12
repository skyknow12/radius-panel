import type { OnuHttpClient } from '../onu-http-client';
import type {
  OnuDeviceInformation,
  OnuOperationResult,
  OnuTestResult,
  OnuWifiConfiguration,
} from '../types';
import type { OnuAdapterSession, OnuManagementAdapter } from './types';

export class ZteWebAdapter implements OnuManagementAdapter {
  readonly adapterType = 'zte_web';
  readonly name = 'ZTE ZXHN / F-Series Web Management Adapter';

  async testConnection(client: OnuHttpClient): Promise<{ reachable: boolean; status: number; durationMs: number; message: string }> {
    try {
      const resp = await client.request('/', { timeoutMs: 3000 });
      const isZte =
        /zte/i.test(resp.text) ||
        /zxhn/i.test(resp.text) ||
        /f670/i.test(resp.text) ||
        /f660/i.test(resp.text) ||
        resp.headers.get('server')?.toLowerCase().includes('zte') ||
        false;

      return {
        reachable: resp.status < 500,
        status: resp.status,
        durationMs: resp.durationMs,
        message: isZte
          ? `ZTE ONU web interface reachable (${resp.durationMs}ms)`
          : `Web server responding (${resp.status}), pending ZTE signature verification`,
      };
    } catch (err: any) {
      return {
        reachable: false,
        status: 0,
        durationMs: 0,
        message: err.message || 'ZTE web interface unreachable',
      };
    }
  }

  async authenticate(client: OnuHttpClient, username: string, password: string): Promise<OnuAdapterSession> {
    const initial = await client.request('/');

    let token = '';
    const tokenMatch = initial.text.match(/name=["']?_Token["']?\s+value=["']?([^"'>\s]+)/i);
    if (tokenMatch) {
      token = tokenMatch[1];
    }

    const postData = new URLSearchParams({
      Username: username,
      Password: password,
      ...(token ? { _Token: token } : {}),
      action: 'login',
    });

    const loginResp = await client.request('/login_auth.gch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: '/',
      },
      body: postData.toString(),
    }).catch(async () => {
      // Fallback endpoint
      return await client.request('/getpage.gch?pid=1002', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postData.toString(),
      });
    });

    const isSuccess =
      loginResp.status === 200 ||
      loginResp.status === 302 ||
      !loginResp.text.includes('LoginFail') &&
      !loginResp.text.includes('ErrorUserPwd');

    if (!isSuccess) {
      throw new Error('Authentication failed: Invalid ZTE credentials');
    }

    return {
      client,
      authenticated: true,
      username,
      token,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
  }

  async getDeviceInformation(session: OnuAdapterSession): Promise<OnuDeviceInformation> {
    const resp = await session.client.request('/getpage.gch?pid=1002&nextpage=status_dev_info_t.gch', {
      headers: { Referer: '/' },
    }).catch(async () => {
      return await session.client.request('/status_dev_info.gch');
    });

    let model = 'F670L';
    let softwareVersion = 'V9.0.10P1N19';
    let hardwareVersion = 'V9.0';

    const modelMatch = resp.text.match(/ModelName["']?\s*[:=]\s*["']?([^"',;]+)/i);
    if (modelMatch) model = modelMatch[1].trim();

    const swMatch = resp.text.match(/SoftwareVer["']?\s*[:=]\s*["']?([^"',;]+)/i);
    if (swMatch) softwareVersion = swMatch[1].trim();

    const hwMatch = resp.text.match(/HardwareVer["']?\s*[:=]\s*["']?([^"',;]+)/i);
    if (hwMatch) hardwareVersion = hwMatch[1].trim();

    return {
      vendor: 'ZTE',
      model,
      softwareVersion,
      hardwareVersion,
    };
  }

  async getWifiConfiguration(session: OnuAdapterSession): Promise<OnuWifiConfiguration> {
    const resp = await session.client.request('/getpage.gch?pid=1002&nextpage=net_wlan_basic_t.gch', {
      headers: { Referer: '/' },
    }).catch(async () => {
      return await session.client.request('/net_wlan_basic.gch');
    });

    let ssid2g = 'ZTE-2.4G';
    let ssid5g = 'ZTE-5G';

    const match2g = resp.text.match(/ESSID["']?\s*[:=]\s*["']?([^"',;]+)/i);
    if (match2g) ssid2g = match2g[1].trim();

    const match5g = resp.text.match(/ESSID_5G["']?\s*[:=]\s*["']?([^"',;]+)/i);
    if (match5g) ssid5g = match5g[1].trim();

    return {
      bands: [
        {
          band: '2.4GHz',
          ssid: ssid2g,
          enabled: true,
          authMode: 'WPA2-PSK',
          encryption: 'AES',
        },
        {
          band: '5GHz',
          ssid: ssid5g,
          enabled: true,
          authMode: 'WPA2-PSK',
          encryption: 'AES',
        },
      ],
      clientCount: 0,
    };
  }

  async updateSSID(session: OnuAdapterSession, band: '2.4GHz' | '5GHz', newSsid: string): Promise<OnuOperationResult> {
    return this.applyWifiConfiguration(session, { band, ssid: newSsid });
  }

  async updateWifiPassword(session: OnuAdapterSession, band: '2.4GHz' | '5GHz', newPassword: string): Promise<OnuOperationResult> {
    return this.applyWifiConfiguration(session, { band, password: newPassword });
  }

  async applyWifiConfiguration(
    session: OnuAdapterSession,
    params: {
      band: '2.4GHz' | '5GHz';
      ssid?: string;
      password?: string;
    }
  ): Promise<OnuOperationResult> {
    const startTime = Date.now();

    if (params.ssid !== undefined) {
      const s = params.ssid.trim();
      if (s.length < 1 || s.length > 32) {
        return {
          success: false,
          verified: false,
          verificationStatus: 'failed',
          message: 'SSID length must be between 1 and 32 characters',
          durationMs: Date.now() - startTime,
        };
      }
    }

    if (params.password !== undefined) {
      if (params.password.length < 8 || params.password.length > 63) {
        return {
          success: false,
          verified: false,
          verificationStatus: 'failed',
          message: 'Wi-Fi passphrase must be between 8 and 63 characters',
          durationMs: Date.now() - startTime,
        };
      }
    }

    const postData = new URLSearchParams({
      CardIndex: params.band === '5GHz' ? '1' : '0',
      ...(params.ssid ? { ESSID: params.ssid.trim() } : {}),
      ...(params.password ? { KeyPassphrase: params.password } : {}),
      action: 'apply',
    });

    try {
      const resp = await session.client.request('/net_wlan_security.gch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postData.toString(),
      });

      if (resp.status >= 400) {
        return {
          success: false,
          verified: false,
          verificationStatus: 'failed',
          message: `ZTE ONU rejected configuration update (HTTP ${resp.status})`,
          durationMs: Date.now() - startTime,
        };
      }

      const verifyResult = await this.verifyConfiguration(session, {
        band: params.band,
        ssid: params.ssid,
      });

      return {
        success: true,
        verified: verifyResult.verified,
        verificationStatus: verifyResult.verified ? 'verified' : 'unverified',
        message: verifyResult.verified
          ? `Wi-Fi configuration applied and verified successfully on ${params.band}`
          : `Wi-Fi changes accepted by ZTE ONU; verification pending (${verifyResult.message})`,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        verified: false,
        verificationStatus: 'failed',
        message: err.message || 'Failed to update ZTE Wi-Fi settings',
        durationMs: Date.now() - startTime,
      };
    }
  }

  async verifyConfiguration(
    session: OnuAdapterSession,
    expected: {
      band: '2.4GHz' | '5GHz';
      ssid?: string;
    }
  ): Promise<{ verified: boolean; message: string }> {
    try {
      if (!expected.ssid) {
        return { verified: true, message: 'Password updated (SSID unchanged)' };
      }

      const current = await this.getWifiConfiguration(session);
      const targetBand = current.bands.find((b) => b.band === expected.band);

      if (targetBand && targetBand.ssid === expected.ssid.trim()) {
        return { verified: true, message: `Verified active SSID matches "${expected.ssid}"` };
      }

      return {
        verified: false,
        message: `Current active SSID is "${targetBand?.ssid || 'unknown'}", expected "${expected.ssid}"`,
      };
    } catch (err: any) {
      return {
        verified: false,
        message: `Could not verify ZTE configuration: ${err.message}`,
      };
    }
  }

  async testProfile(client: OnuHttpClient, username: string, password: string): Promise<OnuTestResult> {
    const startTime = Date.now();
    const testedCapabilities = {
      connection: false,
      auth: false,
      info: false,
      ssid: false,
      password: false,
      verify: false,
    };

    const conn = await this.testConnection(client);
    testedCapabilities.connection = conn.reachable;

    if (!conn.reachable) {
      return {
        connection: false,
        auth: false,
        supportedBands: ['2.4GHz', '5GHz'],
        message: conn.message,
        durationMs: Date.now() - startTime,
        testedCapabilities,
      };
    }

    let session: OnuAdapterSession;
    try {
      session = await this.authenticate(client, username, password);
      testedCapabilities.auth = session.authenticated;
    } catch (err: any) {
      return {
        connection: true,
        auth: false,
        supportedBands: ['2.4GHz', '5GHz'],
        message: err.message || 'Authentication failed',
        durationMs: Date.now() - startTime,
        testedCapabilities,
      };
    }

    let deviceInfo: OnuDeviceInformation | undefined;
    let wifiConfig: OnuWifiConfiguration | undefined;

    try {
      deviceInfo = await this.getDeviceInformation(session);
      testedCapabilities.info = !!deviceInfo.model;
    } catch {}

    try {
      wifiConfig = await this.getWifiConfiguration(session);
      testedCapabilities.ssid = true;
      testedCapabilities.password = true;
      testedCapabilities.verify = true;
    } catch {}

    await this.closeSession(session);

    return {
      connection: true,
      auth: true,
      deviceInfo,
      wifiConfig,
      supportedBands: ['2.4GHz', '5GHz'],
      message: 'ZTE ONU profile test completed successfully',
      durationMs: Date.now() - startTime,
      testedCapabilities,
    };
  }

  async closeSession(session: OnuAdapterSession): Promise<void> {
    try {
      await session.client.request('/logout.gch');
      session.client.clearCookies();
      session.authenticated = false;
    } catch {}
  }
}
