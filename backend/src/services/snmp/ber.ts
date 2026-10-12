/**
 * ASN.1 Basic Encoding Rules (BER) Codec for SNMP v1, v2c, and v3
 * RFC 1157, RFC 1905, RFC 3416
 */

export const ASN1_TAGS = {
  INTEGER: 0x02,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OBJECT_IDENTIFIER: 0x06,
  SEQUENCE: 0x30,
  IP_ADDRESS: 0x40,
  COUNTER32: 0x41,
  GAUGE32: 0x42,
  TIMETICKS: 0x43,
  OPAQUE: 0x44,
  COUNTER64: 0x46,
  NO_SUCH_OBJECT: 0x80,
  NO_SUCH_INSTANCE: 0x81,
  END_OF_MIB_VIEW: 0x82,
  GET_REQUEST: 0xa0,
  GET_NEXT_REQUEST: 0xa1,
  GET_RESPONSE: 0xa2,
  SET_REQUEST: 0xa3,
  GET_BULK_REQUEST: 0xa5,
  REPORT: 0xa8,
};

export class BerReader {
  private buffer: Buffer;
  private offset: number;

  constructor(buf: Buffer) {
    this.buffer = buf;
    this.offset = 0;
  }

  get remaining(): number {
    return this.buffer.length - this.offset;
  }

  get currentOffset(): number {
    return this.offset;
  }

  peekTag(): number | null {
    if (this.offset >= this.buffer.length) return null;
    return this.buffer[this.offset];
  }

  readTag(): number {
    if (this.offset >= this.buffer.length) {
      throw new Error('BER buffer underflow while reading tag');
    }
    return this.buffer[this.offset++];
  }

  readLength(): number {
    if (this.offset >= this.buffer.length) {
      throw new Error('BER buffer underflow while reading length');
    }
    const byte = this.buffer[this.offset++];
    if ((byte & 0x80) === 0) {
      return byte;
    }
    const numOctets = byte & 0x7f;
    if (numOctets === 0) {
      throw new Error('Indefinite length encoding not supported');
    }
    if (this.offset + numOctets > this.buffer.length) {
      throw new Error('BER buffer underflow while reading long length');
    }
    let len = 0;
    for (let i = 0; i < numOctets; i++) {
      len = (len << 8) | this.buffer[this.offset++];
    }
    return len;
  }

  readBytes(len: number): Buffer {
    if (this.offset + len > this.buffer.length) {
      throw new Error(`BER buffer underflow: requested ${len} bytes, remaining ${this.remaining}`);
    }
    const slice = this.buffer.subarray(this.offset, this.offset + len);
    this.offset += len;
    return slice;
  }

  readInteger(): number {
    const tag = this.readTag();
    if (tag !== ASN1_TAGS.INTEGER) {
      throw new Error(`Expected INTEGER tag (0x02), got 0x${tag.toString(16)}`);
    }
    const len = this.readLength();
    const bytes = this.readBytes(len);
    if (len === 0) return 0;
    let val = 0;
    const isNegative = (bytes[0] & 0x80) !== 0;
    for (let i = 0; i < len; i++) {
      val = (val << 8) | bytes[i];
    }
    if (isNegative && len <= 4) {
      val = val - (1 << (len * 8));
    }
    return val;
  }

  readUnsignedInteger(): number {
    this.readTag();
    const len = this.readLength();
    const bytes = this.readBytes(len);
    let val = 0;
    for (let i = 0; i < len; i++) {
      val = (val * 256) + bytes[i];
    }
    return val;
  }

  readBigInt(): bigint {
    this.readTag();
    const len = this.readLength();
    const bytes = this.readBytes(len);
    let val = 0n;
    for (let i = 0; i < len; i++) {
      val = (val << 8n) | BigInt(bytes[i]);
    }
    return val;
  }

  readOctetString(): Buffer {
    const tag = this.readTag();
    if (tag !== ASN1_TAGS.OCTET_STRING) {
      throw new Error(`Expected OCTET STRING tag (0x04), got 0x${tag.toString(16)}`);
    }
    const len = this.readLength();
    return this.readBytes(len);
  }

  readNull(): null {
    const tag = this.readTag();
    if (tag !== ASN1_TAGS.NULL) {
      throw new Error(`Expected NULL tag (0x05), got 0x${tag.toString(16)}`);
    }
    const len = this.readLength();
    if (len !== 0) this.readBytes(len);
    return null;
  }

  readOID(): string {
    const tag = this.readTag();
    if (tag !== ASN1_TAGS.OBJECT_IDENTIFIER) {
      throw new Error(`Expected OID tag (0x06), got 0x${tag.toString(16)}`);
    }
    const len = this.readLength();
    const buf = this.readBytes(len);
    if (buf.length === 0) return '';
    const parts: number[] = [Math.floor(buf[0] / 40), buf[0] % 40];
    let val = 0;
    for (let i = 1; i < buf.length; i++) {
      val = (val << 7) | (buf[i] & 0x7f);
      if ((buf[i] & 0x80) === 0) {
        parts.push(val);
        val = 0;
      }
    }
    return '.' + parts.join('.');
  }

  readSequence(): BerReader {
    const tag = this.readTag();
    if (tag !== ASN1_TAGS.SEQUENCE && (tag & 0x20) === 0) {
      throw new Error(`Expected constructed SEQUENCE tag, got 0x${tag.toString(16)}`);
    }
    const len = this.readLength();
    const seqBytes = this.readBytes(len);
    return new BerReader(seqBytes);
  }

  readAny(): { tag: number; value: any; typeName: string } {
    const tag = this.peekTag();
    if (tag === null) throw new Error('Cannot readAny from empty reader');

    switch (tag) {
      case ASN1_TAGS.INTEGER:
        return { tag, value: this.readInteger(), typeName: 'Integer' };
      case ASN1_TAGS.OCTET_STRING: {
        const buf = this.readOctetString();
        // Check if printable ASCII
        const isPrintable = buf.every((b) => (b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13);
        const strVal = isPrintable ? buf.toString('utf8') : buf.toString('hex');
        return { tag, value: strVal, typeName: isPrintable ? 'OctetString' : 'HexString' };
      }
      case ASN1_TAGS.NULL:
        return { tag, value: this.readNull(), typeName: 'Null' };
      case ASN1_TAGS.OBJECT_IDENTIFIER:
        return { tag, value: this.readOID(), typeName: 'OID' };
      case ASN1_TAGS.IP_ADDRESS: {
        this.readTag();
        const len = this.readLength();
        const buf = this.readBytes(len);
        const ip = Array.from(buf).join('.');
        return { tag, value: ip, typeName: 'IpAddress' };
      }
      case ASN1_TAGS.COUNTER32:
        return { tag, value: this.readUnsignedInteger(), typeName: 'Counter32' };
      case ASN1_TAGS.GAUGE32:
        return { tag, value: this.readUnsignedInteger(), typeName: 'Gauge32' };
      case ASN1_TAGS.TIMETICKS: {
        const ticks = this.readUnsignedInteger();
        return { tag, value: ticks, typeName: 'TimeTicks' };
      }
      case ASN1_TAGS.COUNTER64:
        return { tag, value: this.readBigInt(), typeName: 'Counter64' };
      case ASN1_TAGS.NO_SUCH_OBJECT:
        this.readTag();
        this.readLength();
        return { tag, value: null, typeName: 'NoSuchObject' };
      case ASN1_TAGS.NO_SUCH_INSTANCE:
        this.readTag();
        this.readLength();
        return { tag, value: null, typeName: 'NoSuchInstance' };
      case ASN1_TAGS.END_OF_MIB_VIEW:
        this.readTag();
        this.readLength();
        return { tag, value: null, typeName: 'EndOfMibView' };
      default: {
        this.readTag();
        const len = this.readLength();
        const raw = this.readBytes(len);
        return { tag, value: raw, typeName: `Unknown(0x${tag.toString(16)})` };
      }
    }
  }
}

export class BerWriter {
  private pieces: Buffer[] = [];

  writeTLV(tag: number, content: Buffer): this {
    const len = content.length;
    let lenBuf: Buffer;
    if (len < 128) {
      lenBuf = Buffer.from([len]);
    } else {
      const b: number[] = [];
      let temp = len;
      while (temp > 0) {
        b.unshift(temp & 0xff);
        temp = temp >> 8;
      }
      lenBuf = Buffer.from([0x80 | b.length, ...b]);
    }
    this.pieces.push(Buffer.from([tag]), lenBuf, content);
    return this;
  }

  writeInteger(val: number): this {
    if (val === 0) {
      return this.writeTLV(ASN1_TAGS.INTEGER, Buffer.from([0]));
    }
    const bytes: number[] = [];
    let temp = val;
    while (temp !== 0 && temp !== -1) {
      bytes.unshift(temp & 0xff);
      temp = temp >> 8;
    }
    // Check sign bit
    if (val > 0 && (bytes[0] & 0x80) !== 0) {
      bytes.unshift(0);
    } else if (val < 0 && (bytes[0] & 0x80) === 0) {
      bytes.unshift(0xff);
    }
    if (bytes.length === 0) bytes.push(0);
    return this.writeTLV(ASN1_TAGS.INTEGER, Buffer.from(bytes));
  }

  writeOctetString(str: string | Buffer): this {
    const buf = typeof str === 'string' ? Buffer.from(str, 'utf8') : str;
    return this.writeTLV(ASN1_TAGS.OCTET_STRING, buf);
  }

  writeNull(): this {
    return this.writeTLV(ASN1_TAGS.NULL, Buffer.alloc(0));
  }

  writeOID(oidStr: string): this {
    const parts = oidStr.replace(/^\./, '').split('.').map(Number);
    if (parts.length < 2) {
      throw new Error(`Invalid OID string: ${oidStr}`);
    }
    const bytes: number[] = [parts[0] * 40 + parts[1]];
    for (let i = 2; i < parts.length; i++) {
      let val = parts[i];
      if (val < 128) {
        bytes.push(val);
      } else {
        const b: number[] = [];
        b.push(val & 0x7f);
        val = val >> 7;
        while (val > 0) {
          b.unshift((val & 0x7f) | 0x80);
          val = val >> 7;
        }
        bytes.push(...b);
      }
    }
    return this.writeTLV(ASN1_TAGS.OBJECT_IDENTIFIER, Buffer.from(bytes));
  }

  writeSequence(innerWriter: BerWriter): this {
    return this.writeTLV(ASN1_TAGS.SEQUENCE, innerWriter.toBuffer());
  }

  writeConstructed(tag: number, innerWriter: BerWriter): this {
    return this.writeTLV(tag, innerWriter.toBuffer());
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.pieces);
  }
}

/**
 * Builds an SNMP v1 or v2c request packet
 */
export function buildSnmpPacket(
  version: 0 | 1, // 0 = v1, 1 = v2c
  community: string,
  pduType: number, // 0xa0 = GetRequest, 0xa1 = GetNextRequest, 0xa5 = GetBulkRequest
  requestId: number,
  oids: string[],
  nonRepeaters = 0,
  maxRepetitions = 10,
): Buffer {
  // VarBindList
  const varBindsWriter = new BerWriter();
  for (const oid of oids) {
    const vb = new BerWriter();
    vb.writeOID(oid);
    vb.writeNull();
    varBindsWriter.writeSequence(vb);
  }

  // PDU
  const pduWriter = new BerWriter();
  pduWriter.writeInteger(requestId);
  pduWriter.writeInteger(pduType === ASN1_TAGS.GET_BULK_REQUEST ? nonRepeaters : 0); // error-status or non-repeaters
  pduWriter.writeInteger(pduType === ASN1_TAGS.GET_BULK_REQUEST ? maxRepetitions : 0); // error-index or max-repetitions
  pduWriter.writeSequence(varBindsWriter);

  // Message
  const msgWriter = new BerWriter();
  msgWriter.writeInteger(version);
  msgWriter.writeOctetString(community);
  msgWriter.writeConstructed(pduType, pduWriter);

  const topWriter = new BerWriter();
  topWriter.writeSequence(msgWriter);
  return topWriter.toBuffer();
}

/**
 * Parses an SNMP response packet
 */
export function parseSnmpResponse(buf: Buffer): {
  version: number;
  community: string;
  pduType: number;
  requestId: number;
  errorStatus: number;
  errorIndex: number;
  varBinds: { oid: string; value: any; typeName: string }[];
} {
  const topReader = new BerReader(buf);
  const msgReader = topReader.readSequence();
  const version = msgReader.readInteger();
  const community = msgReader.readOctetString().toString('utf8');

  const pduTag = msgReader.readTag();
  const pduLen = msgReader.readLength();
  const pduBuf = msgReader.readBytes(pduLen);
  const pduReader = new BerReader(pduBuf);

  const requestId = pduReader.readInteger();
  const errorStatus = pduReader.readInteger();
  const errorIndex = pduReader.readInteger();

  const varBinds: { oid: string; value: any; typeName: string }[] = [];
  if (pduReader.remaining > 0) {
    const varBindsSeq = pduReader.readSequence();
    while (varBindsSeq.remaining > 0) {
      const vbReader = varBindsSeq.readSequence();
      const oid = vbReader.readOID();
      const val = vbReader.readAny();
      varBinds.push({
        oid,
        value: val.value,
        typeName: val.typeName,
      });
    }
  }

  return {
    version,
    community,
    pduType: pduTag,
    requestId,
    errorStatus,
    errorIndex,
    varBinds,
  };
}
