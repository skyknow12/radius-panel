import crypto from 'node:crypto';
import dgram from 'node:dgram';

/**
 * Minimal, dependency-free RADIUS (RFC 2865 / 2866 / 5997) UDP client.
 *
 * Used for:
 *   - Status-Server probes (FreeRADIUS reachability, auth + acct ports)
 *   - Access-Request tests (end-to-end authentication check, admin test tool)
 *
 * Every request carries a Message-Authenticator (BlastRADIUS / CVE-2024-3596
 * protection), and every response authenticator is verified against the
 * shared secret.
 *
 * Future modules (CoA / Disconnect-Request on UDP 3799) can extend this class.
 */

export enum RadiusCode {
  AccessRequest = 1,
  AccessAccept = 2,
  AccessReject = 3,
  AccountingRequest = 4,
  AccountingResponse = 5,
  AccessChallenge = 11,
  StatusServer = 12,
  DisconnectRequest = 40,
  DisconnectAck = 41,
  DisconnectNak = 42,
  CoARequest = 43,
  CoAAck = 44,
  CoANak = 45,
}

export const RADIUS_CODE_NAMES: Record<number, string> = {
  1: 'Access-Request',
  2: 'Access-Accept',
  3: 'Access-Reject',
  4: 'Accounting-Request',
  5: 'Accounting-Response',
  11: 'Access-Challenge',
  12: 'Status-Server',
  40: 'Disconnect-Request',
  41: 'Disconnect-ACK',
  42: 'Disconnect-NAK',
  43: 'CoA-Request',
  44: 'CoA-ACK',
  45: 'CoA-NAK',
};

/** Standard attribute numbers used by this client. */
export enum RadiusAttr {
  UserName = 1,
  UserPassword = 2,
  NasIpAddress = 4,
  NasPort = 5,
  ServiceType = 6,
  ReplyMessage = 18,
  CalledStationId = 30,
  CallingStationId = 31,
  NasIdentifier = 32,
  MessageAuthenticator = 80,
}

export interface RadiusAttribute {
  type: number;
  value: Buffer;
}

export interface RadiusResponse {
  code: number;
  codeName: string;
  identifier: number;
  attributes: RadiusAttribute[];
  replyMessage: string | null;
  latencyMs: number;
}

export class RadiusTimeoutError extends Error {
  constructor(host: string, port: number, timeoutMs: number) {
    super(`No response from ${host}:${port} within ${timeoutMs}ms`);
    this.name = 'RadiusTimeoutError';
  }
}

export interface RadiusClientOptions {
  host: string;
  secret: string;
  timeoutMs: number;
  retries?: number;
}

const md5 = (...parts: Buffer[]) => {
  const h = crypto.createHash('md5');
  parts.forEach((p) => h.update(p));
  return h.digest();
};

export class RadiusClient {
  constructor(private readonly opts: RadiusClientOptions) {}

  /** RFC 5997 Status-Server probe. Returns Access-Accept (auth port) or Accounting-Response (acct port). */
  statusServer(port: number, nasIdentifier = 'radius-pro-healthcheck'): Promise<RadiusResponse> {
    return this.send(port, RadiusCode.StatusServer, [
      { type: RadiusAttr.NasIdentifier, value: Buffer.from(nasIdentifier) },
    ]);
  }

  /** PAP Access-Request. */
  accessRequest(
    port: number,
    username: string,
    password: string,
    nasIdentifier = 'radius-pro-panel',
  ): Promise<RadiusResponse> {
    return this.send(port, RadiusCode.AccessRequest, [
      { type: RadiusAttr.UserName, value: Buffer.from(username, 'utf8') },
      { type: RadiusAttr.UserPassword, value: Buffer.from(password, 'utf8') },
      { type: RadiusAttr.NasIdentifier, value: Buffer.from(nasIdentifier) },
      { type: RadiusAttr.ServiceType, value: uint32(8) }, // Authenticate-Only
    ]);
  }

  private async send(port: number, code: RadiusCode, attrs: RadiusAttribute[]): Promise<RadiusResponse> {
    const attempts = (this.opts.retries ?? 0) + 1;
    let lastError: Error | undefined;
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.sendOnce(port, code, attrs);
      } catch (err) {
        lastError = err as Error;
        if (!(err instanceof RadiusTimeoutError)) throw err;
      }
    }
    throw lastError ?? new Error('RADIUS request failed');
  }

  private sendOnce(port: number, code: RadiusCode, attrs: RadiusAttribute[]): Promise<RadiusResponse> {
    const { host, secret, timeoutMs } = this.opts;
    const secretBuf = Buffer.from(secret, 'utf8');
    const identifier = crypto.randomInt(0, 256);
    const requestAuth = crypto.randomBytes(16);
    const packet = encodePacket(code, identifier, requestAuth, attrs, secretBuf);

    return new Promise<RadiusResponse>((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const started = process.hrtime.bigint();
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.close();
        fn();
      };

      const timer = setTimeout(() => finish(() => reject(new RadiusTimeoutError(host, port, timeoutMs))), timeoutMs);

      socket.on('error', (err) => finish(() => reject(err)));

      socket.on('message', (msg) => {
        if (msg.length < 20 || msg[1] !== identifier) return; // not ours
        const length = msg.readUInt16BE(2);
        if (length > msg.length) return;
        const response = msg.subarray(0, length);

        // Verify Response Authenticator: MD5(Code+ID+Length+RequestAuth+Attributes+Secret)
        const expected = md5(response.subarray(0, 4), requestAuth, response.subarray(20), secretBuf);
        if (!crypto.timingSafeEqual(expected, response.subarray(4, 20))) {
          finish(() => reject(new Error('Invalid response authenticator (shared secret mismatch?)')));
          return;
        }

        const attributes = decodeAttributes(response.subarray(20));
        const reply = attributes.find((a) => a.type === RadiusAttr.ReplyMessage);
        const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
        finish(() =>
          resolve({
            code: response[0],
            codeName: RADIUS_CODE_NAMES[response[0]] ?? `Code-${response[0]}`,
            identifier,
            attributes,
            replyMessage: reply ? reply.value.toString('utf8') : null,
            latencyMs: Math.round(latencyMs * 10) / 10,
          }),
        );
      });

      socket.send(packet, port, host, (err) => {
        if (err) finish(() => reject(err));
      });
    });
  }
}

// -----------------------------------------------------------------------------
//  Encoding helpers
// -----------------------------------------------------------------------------

function uint32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}

/** RFC 2865 §5.2 User-Password hiding. */
function encryptPassword(password: Buffer, secret: Buffer, requestAuth: Buffer): Buffer {
  if (password.length > 128) throw new Error('Password too long for RADIUS (max 128 bytes)');
  const padded = Buffer.alloc(Math.max(16, Math.ceil(password.length / 16) * 16));
  password.copy(padded);
  const out = Buffer.alloc(padded.length);
  let prev = requestAuth;
  for (let i = 0; i < padded.length; i += 16) {
    const b = md5(secret, prev);
    for (let j = 0; j < 16; j++) out[i + j] = padded[i + j] ^ b[j];
    prev = out.subarray(i, i + 16);
  }
  return out;
}

function encodeAttribute(type: number, value: Buffer): Buffer {
  if (value.length > 253) throw new Error(`Attribute ${type} too long`);
  return Buffer.concat([Buffer.from([type, value.length + 2]), value]);
}

function encodePacket(
  code: RadiusCode,
  identifier: number,
  requestAuth: Buffer,
  attrs: RadiusAttribute[],
  secret: Buffer,
): Buffer {
  const encoded: Buffer[] = attrs.map((a) =>
    encodeAttribute(a.type, a.type === RadiusAttr.UserPassword ? encryptPassword(a.value, secret, requestAuth) : a.value),
  );

  // Message-Authenticator placeholder (16 zero bytes), filled after HMAC
  const maIndex = encoded.length;
  encoded.push(encodeAttribute(RadiusAttr.MessageAuthenticator, Buffer.alloc(16)));

  const body = Buffer.concat(encoded);
  const length = 20 + body.length;
  if (length > 4096) throw new Error('RADIUS packet too large');

  const header = Buffer.alloc(4);
  header[0] = code;
  header[1] = identifier;
  header.writeUInt16BE(length, 2);

  const packet = Buffer.concat([header, requestAuth, body]);

  // HMAC-MD5 over the whole packet with the MA value zeroed (RFC 3579 §3.2)
  const maOffset = 20 + encoded.slice(0, maIndex).reduce((n, b) => n + b.length, 0) + 2;
  const hmac = crypto.createHmac('md5', secret).update(packet).digest();
  hmac.copy(packet, maOffset);
  return packet;
}

function decodeAttributes(buf: Buffer): RadiusAttribute[] {
  const attrs: RadiusAttribute[] = [];
  let offset = 0;
  while (offset + 2 <= buf.length) {
    const type = buf[offset];
    const len = buf[offset + 1];
    if (len < 2 || offset + len > buf.length) break;
    attrs.push({ type, value: buf.subarray(offset + 2, offset + len) });
    offset += len;
  }
  return attrs;
}
