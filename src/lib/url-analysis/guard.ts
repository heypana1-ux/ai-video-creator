import { promises as dns } from "node:dns";
import { isIP } from "node:net";

/**
 * SSRF protection for the website importer.
 *
 * The importer fetches a URL the user typed, so it is a classic SSRF sink. The
 * defence has three layers:
 *   1. Only http/https, no credentials, only ports 80/443.
 *   2. The hostname is resolved and *every* returned address must be public.
 *   3. Redirects are followed manually and each hop runs through 1 and 2 again.
 *
 * Note on the residual DNS-rebinding window: between the check and the socket
 * connect the record could change. For a stronger guarantee, pin the validated
 * address at connect time via a custom agent - documented in docs/ARCHITECTURE.md.
 */

export class UrlGuardError extends Error {
  constructor(
    readonly reason:
      | "invalid_url"
      | "bad_protocol"
      | "credentials"
      | "bad_port"
      | "blocked_host"
      | "private_address"
      | "dns_failed"
      | "too_many_redirects"
      | "too_large"
      | "not_html",
    message: string,
  ) {
    super(message);
    this.name = "UrlGuardError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_PORTS = new Set(["", "80", "443"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".test",
  ".example",
  ".invalid",
];

function ipv4ToInt(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/** CIDR blocks that must never be reachable from a user-supplied URL. */
const BLOCKED_V4_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link local incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved incl. 255.255.255.255
];

export function isBlockedIpv4(address: string): boolean {
  const value = ipv4ToInt(address);
  if (value === null) return true;
  return BLOCKED_V4_RANGES.some(([base, bits]) => {
    const baseValue = ipv4ToInt(base);
    if (baseValue === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (baseValue & mask);
  });
}

/**
 * Expands an IPv6 address into its eight 16-bit groups.
 *
 * Parsing rather than regex matching matters here: `new URL()` normalises
 * `[::ffff:169.254.169.254]` to `[::ffff:a9fe:a9fe]`, so a pattern that only
 * knows the dotted form would wave the metadata endpoint straight through.
 */
export function expandIpv6(address: string): number[] | null {
  let value = address.toLowerCase().split("%")[0];
  if (!value) return null;

  // A trailing dotted quad contributes the last two groups.
  const dotted = value.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) {
    const octets = dotted[1].split(".").map(Number);
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return null;
    }
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    value = `${value.slice(0, dotted.index)}${high}:${low}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;

  const parse = (part: string): number[] | null => {
    if (part === "") return [];
    const groups: number[] = [];
    for (const chunk of part.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(chunk)) return null;
      groups.push(Number.parseInt(chunk, 16));
    }
    return groups;
  };

  const head = parse(halves[0] ?? "");
  const tail = halves.length === 2 ? parse(halves[1] ?? "") : [];
  if (!head || !tail) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;

  const fill = 8 - head.length - tail.length;
  if (fill < 1) return null;
  return [...head, ...Array.from({ length: fill }, () => 0), ...tail];
}

function ipv4FromGroups(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

export function isBlockedIpv6(address: string): boolean {
  const groups = expandIpv6(address);
  if (!groups) return true;

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const leadingZeros = (count: number) => groups.slice(0, count).every((group) => group === 0);

  if (groups.every((group) => group === 0)) return true; // ::
  if (leadingZeros(7) && g7 === 1) return true; // ::1 loopback

  // IPv4-mapped (::ffff:a.b.c.d) and the deprecated IPv4-compatible form.
  if (leadingZeros(5) && g5 === 0xffff) return isBlockedIpv4(ipv4FromGroups(g6, g7));
  if (leadingZeros(6) && (g6 !== 0 || g7 !== 0)) return isBlockedIpv4(ipv4FromGroups(g6, g7));

  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g0 === 0x0064 && g1 === 0xff9b) return true; // 64:ff9b::/96 NAT64
  if (g0 === 0x2002) return isBlockedIpv4(ipv4FromGroups(g1, g2)); // 6to4
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
  if (g0 === 0x2001 && (g1 & 0xfffe) === 0x0002) return true; // benchmarking
  void g3;
  void g4;

  return false;
}

export function isBlockedAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return isBlockedIpv4(address);
  if (kind === 6) return isBlockedIpv6(address);
  return true;
}

/**
 * `URL.hostname` keeps the brackets around IPv6 literals (`[::1]`) and may keep
 * a trailing root dot. Both have to go before any IP or suffix comparison,
 * otherwise `http://[::1]/` slips past every check.
 */
export function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "").replace(/^\[/, "").replace(/\]$/, "");
}

export function isBlockedHostname(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  // Bare hostnames without a dot cannot be public names.
  if (isIP(host) === 0 && !host.includes(".")) return true;
  return false;
}

/** Structural checks that need no network access. */
export function validateUrlShape(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlGuardError("invalid_url", "Die URL konnte nicht gelesen werden.");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UrlGuardError("bad_protocol", "Es sind nur http- und https-URLs erlaubt.");
  }
  if (url.username || url.password) {
    throw new UrlGuardError("credentials", "URLs mit Zugangsdaten werden nicht unterstützt.");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new UrlGuardError("bad_port", "Es sind nur die Ports 80 und 443 erlaubt.");
  }
  const host = normalizeHost(url.hostname);
  if (isBlockedHostname(host)) {
    throw new UrlGuardError(
      "blocked_host",
      "Interne oder lokale Adressen können nicht analysiert werden.",
    );
  }
  if (isIP(host) !== 0 && isBlockedAddress(host)) {
    throw new UrlGuardError(
      "private_address",
      "Private IP-Adressen können nicht analysiert werden.",
    );
  }
  return url;
}

export type Resolver = (hostname: string) => Promise<string[]>;

export const defaultResolver: Resolver = async (hostname) => {
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => entry.address);
};

/**
 * Full validation: shape plus DNS. Every resolved address must be public -
 * a single private answer rejects the URL.
 */
export async function assertPublicUrl(
  rawUrl: string,
  resolver: Resolver = defaultResolver,
): Promise<URL> {
  const url = validateUrlShape(rawUrl);
  const host = normalizeHost(url.hostname);
  // A literal address was already checked against the block list above.
  if (isIP(host) !== 0) return url;

  let addresses: string[];
  try {
    addresses = await resolver(host);
  } catch {
    throw new UrlGuardError("dns_failed", "Der Hostname konnte nicht aufgelöst werden.");
  }

  if (addresses.length === 0) {
    throw new UrlGuardError("dns_failed", "Der Hostname konnte nicht aufgelöst werden.");
  }
  if (addresses.some((address) => isBlockedAddress(address))) {
    throw new UrlGuardError(
      "private_address",
      "Der Host zeigt auf eine interne Adresse und wird blockiert.",
    );
  }
  return url;
}
