import net from 'node:net';

/**
 * Validates target IP against SSRF and unauthorized destinations
 */
export function validateOnuTargetIp(targetIp: string): void {
  const trimmed = targetIp.trim().toLowerCase();

  if (!trimmed) {
    throw new Error('ONU target IP address is required');
  }

  // Block localhost and standard aliases
  if (trimmed === 'localhost' || trimmed === '127.0.0.1' || trimmed === '::1') {
    throw new Error('Access denied: Localhost and loopback addresses cannot be targeted');
  }

  // Block cloud metadata services (AWS, GCP, Azure, DigitalOcean)
  if (trimmed.startsWith('169.254.') || trimmed === 'metadata.google.internal') {
    throw new Error('Access denied: Cloud metadata services cannot be targeted');
  }

  // Block zero and broadcast addresses
  if (trimmed === '0.0.0.0' || trimmed === '255.255.255.255') {
    throw new Error('Access denied: Unspecified or broadcast addresses cannot be targeted');
  }

  if (net.isIPv4(trimmed)) {
    const parts = trimmed.split('.').map(Number);
    // 127.0.0.0/8
    if (parts[0] === 127) {
      throw new Error('Access denied: Loopback IPv4 addresses cannot be targeted');
    }
    // 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) {
      throw new Error('Access denied: Link-local addresses cannot be targeted');
    }
    // 224.0.0.0/4 (Multicast)
    if (parts[0] >= 224 && parts[0] <= 239) {
      throw new Error('Access denied: Multicast addresses cannot be targeted');
    }

    // Authorized Management Subnets check
    // RFC 1918 Private networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) and RFC 6598 CGNAT (100.64.0.0/10)
    const isPrivateOrCgnat =
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);

    if (!isPrivateOrCgnat) {
      throw new Error(
        `Access denied: Target IP ${trimmed} is not within authorized ISP management subnets (RFC 1918 / RFC 6598)`
      );
    }
  } else if (!net.isIPv6(trimmed)) {
    throw new Error(`Invalid IP address format: ${trimmed}`);
  }
}

export interface OnuHttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxRedirects?: number;
}

export interface OnuHttpResponse {
  status: number;
  headers: Headers;
  text: string;
  durationMs: number;
}

export class OnuHttpClient {
  private baseHost: string;
  private port: number;
  private protocol: 'http' | 'https';
  private cookies: Map<string, string> = new Map();

  constructor(targetIp: string, port = 80, protocol: 'http' | 'https' = 'http') {
    validateOnuTargetIp(targetIp);
    this.baseHost = targetIp.trim();
    this.port = port || 80;
    this.protocol = protocol || 'http';
  }

  getCookieString(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  setCookie(key: string, value: string): void {
    this.cookies.set(key, value);
  }

  clearCookies(): void {
    this.cookies.clear();
  }

  /**
   * Safe fetch with SSRF validation, timeouts, and cookie tracking
   */
  async request(path: string, options: OnuHttpRequestOptions = {}): Promise<OnuHttpResponse> {
    const url = `${this.protocol}://${this.baseHost}:${this.port}${path.startsWith('/') ? path : '/' + path}`;
    const timeoutMs = options.timeoutMs || 4000;
    const maxRedirects = options.maxRedirects ?? 3;

    let currentUrl = url;
    let redirectCount = 0;

    const startTime = Date.now();

    while (redirectCount <= maxRedirects) {
      const parsed = new URL(currentUrl);
      validateOnuTargetIp(parsed.hostname);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Fiberworld-ONU-Probe/1.0',
          Accept: 'text/html,application/xhtml+xml,application/json,*/*',
          ...(options.headers || {}),
        };

        const cookieHeader = this.getCookieString();
        if (cookieHeader) {
          headers['Cookie'] = cookieHeader;
        }

        const resp = await fetch(currentUrl, {
          method: options.method || 'GET',
          headers,
          body: options.body,
          signal: controller.signal,
          redirect: 'manual',
        });

        clearTimeout(timer);

        // Store received Set-Cookie headers
        const setCookieHeaders = resp.headers.getSetCookie
          ? resp.headers.getSetCookie()
          : resp.headers.get('set-cookie')
          ? [resp.headers.get('set-cookie')!]
          : [];

        for (const raw of setCookieHeaders) {
          const cookiePair = raw.split(';')[0];
          const eqIdx = cookiePair.indexOf('=');
          if (eqIdx > 0) {
            const name = cookiePair.slice(0, eqIdx).trim();
            const val = cookiePair.slice(eqIdx + 1).trim();
            this.cookies.set(name, val);
          }
        }

        // Handle redirects safely
        if ([301, 302, 303, 307, 308].includes(resp.status)) {
          const location = resp.headers.get('location');
          if (location && redirectCount < maxRedirects) {
            redirectCount++;
            currentUrl = new URL(location, currentUrl).toString();
            continue;
          }
        }

        const text = await resp.text();
        const durationMs = Date.now() - startTime;

        return {
          status: resp.status,
          headers: resp.headers,
          text,
          durationMs,
        };
      } catch (err: any) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          throw new Error(`ONU probe to ${this.baseHost} timed out after ${timeoutMs}ms`);
        }
        throw new Error(`ONU network error (${this.baseHost}): ${err.message}`);
      }
    }

    throw new Error(`Too many redirects connecting to ONU ${this.baseHost}`);
  }
}
