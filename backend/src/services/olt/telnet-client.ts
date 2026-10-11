import net from 'node:net';
import { EventEmitter } from 'node:events';
import { logger } from '../../lib/logger';

// Telnet Protocol Bytes (RFC 854)
const IAC = 255;
const DONT = 254;
const DO = 253;
const WONT = 252;
const WILL = 251;
const SB = 250;
const SE = 240;

export interface TelnetOptions {
  host: string;
  port: number;
  timeoutMs?: number;
  terminalWidth?: number;
  terminalHeight?: number;
}

export class TelnetClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer = '';
  private connected = false;
  private subnegotiation = false;
  private subnegotiationBuffer: number[] = [];

  constructor() {
    super();
  }

  /** Connect to Telnet server with timeout */
  public connect(options: TelnetOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutMs = options.timeoutMs || 8000;
      let timer: NodeJS.Timeout | null = setTimeout(() => {
        if (this.socket) {
          this.socket.destroy();
        }
        reject(new Error(`Connection to ${options.host}:${options.port} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.socket = new net.Socket();
      this.socket.setTimeout(timeoutMs);

      this.socket.on('connect', () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        this.connected = true;
        resolve();
      });

      this.socket.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      this.socket.on('error', (err: Error) => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        reject(err);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.emit('close');
      });

      this.socket.connect(options.port, options.host);
    });
  }

  /** Handle incoming data stream and Telnet IAC negotiations */
  private handleData(data: Buffer): void {
    const cleanBytes: number[] = [];
    let i = 0;

    while (i < data.length) {
      const byte = data[i];

      if (this.subnegotiation) {
        if (byte === IAC && i + 1 < data.length && data[i + 1] === SE) {
          this.subnegotiation = false;
          i += 2;
          continue;
        }
        this.subnegotiationBuffer.push(byte);
        i++;
        continue;
      }

      if (byte === IAC) {
        if (i + 1 >= data.length) {
          i++;
          continue;
        }
        const cmd = data[i + 1];

        if (cmd === SB) {
          this.subnegotiation = true;
          this.subnegotiationBuffer = [];
          i += 2;
          continue;
        }

        if (cmd === DO || cmd === DONT || cmd === WILL || cmd === WONT) {
          if (i + 2 < data.length) {
            const opt = data[i + 2];
            this.handleNegotiation(cmd, opt);
            i += 3;
            continue;
          }
        }
        i += 2;
        continue;
      }

      cleanBytes.push(byte);
      i++;
    }

    if (cleanBytes.length > 0) {
      const text = Buffer.from(cleanBytes).toString('latin1');
      // Strip ANSI escape codes
      const sanitized = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
      this.buffer += sanitized;
      this.emit('data', sanitized);
    }
  }

  /** Reply to Telnet IAC options */
  private handleNegotiation(cmd: number, opt: number): void {
    if (!this.socket || !this.connected) return;

    if (cmd === DO) {
      // Server wants us to do option: we WONT unless suppress go-ahead
      const reply = opt === 3 /* Suppress Go Ahead */ ? WILL : WONT;
      this.socket.write(Buffer.from([IAC, reply, opt]));
    } else if (cmd === WILL) {
      // Server offers option: we DO echo or suppress go-ahead
      const reply = opt === 1 /* Echo */ || opt === 3 /* Suppress Go Ahead */ ? DO : DONT;
      this.socket.write(Buffer.from([IAC, reply, opt]));
    } else if (cmd === DONT) {
      this.socket.write(Buffer.from([IAC, WONT, opt]));
    } else if (cmd === WONT) {
      this.socket.write(Buffer.from([IAC, DONT, opt]));
    }
  }

  /** Wait until the incoming buffer matches any of the given patterns */
  public waitFor(patterns: RegExp[], timeoutMs = 10000): Promise<{ matchIndex: number; matchedText: string; buffer: string }> {
    return new Promise((resolve, reject) => {
      // Check existing buffer first
      for (let idx = 0; idx < patterns.length; idx++) {
        const p = patterns[idx];
        const match = p.exec(this.buffer);
        if (match) {
          const matchedText = match[0];
          const fullBuffer = this.buffer;
          this.buffer = ''; // Reset buffer after match
          return resolve({ matchIndex: idx, matchedText, buffer: fullBuffer });
        }
      }

      let timer: NodeJS.Timeout | null = setTimeout(() => {
        this.removeListener('data', onData);
        reject(new Error(`Timeout waiting for patterns [${patterns.map((p) => p.source).join(', ')}] after ${timeoutMs}ms. Received: ${this.buffer.slice(-200)}`));
      }, timeoutMs);

      const onData = () => {
        // Handle Huawei CLI pagination if seen
        if (this.buffer.includes('---- More ( Press \'Q\' to break') || this.buffer.includes('--More--')) {
          this.socket?.write(' ');
        }

        for (let idx = 0; idx < patterns.length; idx++) {
          const p = patterns[idx];
          const match = p.exec(this.buffer);
          if (match) {
            if (timer) {
              clearTimeout(timer);
              timer = null;
            }
            this.removeListener('data', onData);
            const matchedText = match[0];
            const fullBuffer = this.buffer;
            this.buffer = ''; // Reset
            return resolve({ matchIndex: idx, matchedText, buffer: fullBuffer });
          }
        }
      };

      this.on('data', onData);
    });
  }

  /** Send string to socket */
  public write(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        return reject(new Error('Socket not connected'));
      }
      this.socket.write(text, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /** Send command and wait for prompt */
  public async execCommand(
    command: string,
    promptPatterns: RegExp[] = [/>\s*$/, /#\s*$/, /\(config\)#\s*$/, /\(config-if-.*\)?#\s*$/],
    timeoutMs = 15000
  ): Promise<string> {
    this.buffer = '';
    await this.write(command + '\n');
    const result = await this.waitFor(promptPatterns, timeoutMs);
    return result.buffer;
  }

  /** Close connection gracefully */
  public disconnect(): void {
    if (this.socket) {
      try {
        this.socket.write('quit\n');
      } catch {}
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.buffer = '';
  }
}
