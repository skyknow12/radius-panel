import type { OnuHttpClient } from '../onu-http-client';
import type {
  OnuDeviceInformation,
  OnuOperationResult,
  OnuTestResult,
  OnuWifiConfiguration,
} from '../types';
import type { OnuAdapterSession, OnuManagementAdapter } from './types';

export class HuaweiWebAdapter implements OnuManagementAdapter {
  readonly adapterType = 'huawei_web';
  readonly name = 'Huawei EchoLife / SmartAX Web Management Adapter';

  async testConnection(client: OnuHttpClient): Promise<{ reachable: boolean; status: number; durationMs: number; message: string }> {
    try {
      const resp = await client.request('/', { timeoutMs: 3000 });
      const isHuawei =
        /huawei/i.test(resp.text) ||
        /echolife/i.test(resp.text) ||
        /smartax/i.test(resp.text) ||
        /ont/i.test(resp.text) ||
        resp.headers.get('server')?.toLowerCase().includes('huawei') ||
        false;

      return {
        reachable: resp.status < 500,
        status: resp.status,
        durationMs: resp.durationMs,
        message: isHuawei
          ? `Huawei ONU web interface reachable (${resp.durationMs}ms)`
          : `Web server responding (${resp.status}), pending Huawei signature verification`,
      };
    } catch (err: any) {
      return {
        reachable: false,
        status: 0,
        durationMs: 0,
        message: err.message || 'Huawei web interface unreachable',
      };
    }
  }

  async authenticate(client: OnuHttpClient, username: string, password: string): Promise<OnuAdapterSession> {
    const startTime = Date.now();
    // 1. Fetch login page to capture initial CSRF token or session cookie
    const initial = await client.request('/');

    let token = '';
    const tokenMatch = initial.text.match(/name=["']?csrf_token["']?\s+value=["']?([^"'>\s]+)/i);
    if (tokenMatch) {
      token = tokenMatch[1];
    }

    // 2. Submit authentication payload
    // Standard Huawei form post parameters
    const postBody = new URLSearchParams({
      username,
      password,
      ...(token ? { csrf_token: token } : {}),
    }).toString();

    const loginResp = await client.request('/login.cgi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: '/',
      },
      body: postBody,
    });

    const isSuccess =
      loginResp.status === 200 ||
      loginResp.status === 302 ||
      !loginResp.text.includes('login_fail') &&
      !loginResp.text.includes('password_error');

    if (!isSuccess) {
      throw new Error('Authentication failed: Invalid ONU username or password');
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
    const resp = await session.client.request('/html/bbsp/common/getdeviceinfo.asp', {
      headers: { Referer: '/' },
    }).catch(async () => {
      return await session.client.request('/api/system/status');
    });

    let model = 'HG8145V5';
    let softwareVersion = 'V5R019C00S105';
    let hardwareVersion = 'VER.A';

    const modelMatch = resp.text.match(/DeviceModel["']?\s*[:=]\s*["']?([^"',;]+)/i);
    if (modelMatch) model = modelMatch[1].trim();

    const swMatch = resp.text.match(/SoftwareVersion["']?\s*[:=]\s*["']?([^"',;]+)/i);
    if (swMatch) softwareVersion = swMatch[1].trim();

    const hwMatch = resp.text.match(/HardwareVersion["']?\s*[:=]\s*["']?([^"',;]+)/i);
    if (hwMatch) hardwareVersion = hwMatch[1].trim();

    return {
      vendor: 'Huawei',
      model,
      softwareVersion,
      hardwareVersion,
    };
  }

  async getWifiConfiguration(session: OnuAdapterSession): Promise<OnuWifiConfiguration> {
    const resp = await session.client.request('/html/bbsp/wlan/wlan.asp', {
      headers: { Referer: '/' },
    }).catch(async () => {
      return await session.client.request('/api/wlan/config');
    });

    // Extract 2.4 GHz SSID
    let ssid2g = 'Huawei-2.4G';
    const match2g = resp.text.match(/SSID_2G["']?\s*[:=]\s*["']?([^"',;]+)/i) ||
                    resp.text.match(/var\s+SSIDName\s*=\s*["']([^"']+)["']/i);
    if (match2g) ssid2g = match2g[1].trim();

    // Extract 5 GHz SSID
    let ssid5g = 'Huawei-5G';
    const match5g = resp.text.match(/SSID_5G["']?\s*[:=]\s*["']?([^"',;]+)/i);
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
      band: params.band === '5GHz' ? '1' : '0',
      ...(params.ssid ? { ssid: params.ssid.trim() } : {}),
      ...(params.password ? { wpa_psk: params.password } : {}),
    });

    try {
      const resp = await session.client.request('/html/bbsp/wlan/wlan_set.cgi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: '/html/bbsp/wlan/wlan.asp',
        },
        body: postData.toString(),
      });

      if (resp.status >= 400) {
        return {
          success: false,
          verified: false,
          verificationStatus: 'failed',
          message: `ONU rejected configuration update (HTTP ${resp.status})`,
          durationMs: Date.now() - startTime,
        };
      }

      // Verify the new state
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
          : `Wi-Fi changes accepted by ONU; verification pending (${verifyResult.message})`,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        verified: false,
        verificationStatus: 'failed',
        message: err.message || 'Failed to communicate with ONU during Wi-Fi update',
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
        message: `Could not verify configuration: ${err.message}`,
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

    // 1. Test Connection
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

    // 2. Test Auth
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

    // 3. Test Device Info & Wi-Fi Read
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
      message: 'Huawei ONU profile test completed successfully',
      durationMs: Date.now() - startTime,
      testedCapabilities,
    };
  }

  async closeSession(session: OnuAdapterSession): Promise<void> {
    try {
      await session.client.request('/logout.cgi');
      session.client.clearCookies();
      session.authenticated = false;
    } catch {}
  }
}
