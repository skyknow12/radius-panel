/**
 * Utility functions for normalizing, validating, and formatting MAC addresses.
 *
 * Supported input formats:
 *   - Colon separated:     AA:BB:CC:DD:EE:FF (or aa:bb:cc:dd:ee:ff)
 *   - Hyphen separated:    AA-BB-CC-DD-EE-FF
 *   - Cisco dotted:        AABB.CCDD.EEFF
 *   - Raw continuous hex:  AABBCCDDEEFF
 *   - With interface/SSID: 00:11:22:33:44:55 eth0 / 0011.2233.4455/ge-0/0/0
 */

const MAC_REGEX = /([0-9a-fA-F]{2})[-:.]?([0-9a-fA-F]{2})[-:.]?([0-9a-fA-F]{2})[-:.]?([0-9a-fA-F]{2})[-:.]?([0-9a-fA-F]{2})[-:.]?([0-9a-fA-F]{2})/;

/**
 * Normalizes any valid MAC address representation into standard uppercase colon format:
 * "AA:BB:CC:DD:EE:FF"
 * Returns null if the input is empty or does not contain 6 valid octets.
 */
export function normalizeMacAddress(mac: string | null | undefined): string | null {
  if (!mac || typeof mac !== 'string') return null;
  const match = mac.trim().match(MAC_REGEX);
  if (!match) return null;
  return `${match[1]}:${match[2]}:${match[3]}:${match[4]}:${match[5]}:${match[6]}`.toUpperCase();
}

/**
 * Validates whether the given string contains a valid, trustworthy MAC address.
 */
export function isValidMacAddress(mac: string | null | undefined): boolean {
  return normalizeMacAddress(mac) !== null;
}

/**
 * Formats a normalized MAC address into specific vendor conventions.
 */
export function formatMacForVendor(
  mac: string,
  format: 'colon' | 'hyphen' | 'cisco' | 'raw' = 'colon'
): string | null {
  const norm = normalizeMacAddress(mac);
  if (!norm) return null;

  const parts = norm.split(':');
  switch (format) {
    case 'hyphen':
      return parts.join('-');
    case 'cisco':
      return `${parts[0]}${parts[1]}.${parts[2]}${parts[3]}.${parts[4]}${parts[5]}`.toLowerCase();
    case 'raw':
      return parts.join('');
    case 'colon':
    default:
      return norm;
  }
}
