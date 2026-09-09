import { describe, expect, it } from "vitest";

import {
  UrlGuardError,
  assertPublicUrl,
  expandIpv6,
  isBlockedHostname,
  isBlockedIpv4,
  isBlockedIpv6,
  validateUrlShape,
} from "@/lib/url-analysis/guard";

describe("isBlockedIpv4", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "0.0.0.0",
    "100.64.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "198.18.0.5",
  ])("blocks %s", (address) => {
    expect(isBlockedIpv4(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "11.0.0.1"])(
    "allows %s",
    (address) => {
      expect(isBlockedIpv4(address)).toBe(false);
    },
  );

  it("blocks malformed input", () => {
    expect(isBlockedIpv4("not-an-ip")).toBe(true);
    expect(isBlockedIpv4("999.1.1.1")).toBe(true);
  });
});

describe("isBlockedIpv6", () => {
  it.each([
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "64:ff9b::1",
  ])("blocks %s", (address) => {
    expect(isBlockedIpv6(address)).toBe(true);
  });

  it("blocks the compressed hex form of IPv4-mapped private addresses", () => {
    // new URL() rewrites ::ffff:169.254.169.254 into this shape.
    expect(isBlockedIpv6("::ffff:a9fe:a9fe")).toBe(true);
    expect(isBlockedIpv6("::ffff:7f00:1")).toBe(true);
    expect(isBlockedIpv6("2002:7f00:1::")).toBe(true); // 6to4 wrapping 127.0.0.1
  });

  it("allows a public address", () => {
    expect(isBlockedIpv6("2606:4700:4700::1111")).toBe(false);
    expect(isBlockedIpv6("2a00:1450:4001:81b::200e")).toBe(false);
  });

  it("blocks unparseable input", () => {
    expect(isBlockedIpv6("nonsense")).toBe(true);
    expect(isBlockedIpv6("1::2::3")).toBe(true);
  });
});

describe("expandIpv6", () => {
  it("expands compressed and dotted forms", () => {
    expect(expandIpv6("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(expandIpv6("::ffff:127.0.0.1")).toEqual([0, 0, 0, 0, 0, 0xffff, 0x7f00, 1]);
    expect(expandIpv6("2001:db8::8:800:200c:417a")).toHaveLength(8);
  });

  it("rejects malformed addresses", () => {
    expect(expandIpv6("1:2:3:4:5:6:7")).toBeNull();
    expect(expandIpv6("gggg::1")).toBeNull();
  });
});

describe("isBlockedHostname", () => {
  it.each([
    "localhost",
    "app.localhost",
    "printer.local",
    "db.internal",
    "metadata.google.internal",
    "intranet-host",
  ])("blocks %s", (hostname) => {
    expect(isBlockedHostname(hostname)).toBe(true);
  });

  it("allows a normal public hostname", () => {
    expect(isBlockedHostname("example.com")).toBe(false);
    expect(isBlockedHostname("www.beispiel.de")).toBe(false);
  });
});

describe("validateUrlShape", () => {
  it("rejects non-http protocols", () => {
    expect(() => validateUrlShape("file:///etc/passwd")).toThrow(UrlGuardError);
    expect(() => validateUrlShape("gopher://example.com")).toThrow(UrlGuardError);
  });

  it("rejects embedded credentials", () => {
    expect(() => validateUrlShape("https://user:pass@example.com")).toThrow(
      /Zugangsdaten/,
    );
  });

  it("rejects unusual ports", () => {
    expect(() => validateUrlShape("http://example.com:2375/")).toThrow(/Ports/);
  });

  it("rejects literal private addresses, including bracketed IPv6", () => {
    expect(() => validateUrlShape("http://127.0.0.1/")).toThrow(UrlGuardError);
    expect(() => validateUrlShape("http://[::1]/")).toThrow(UrlGuardError);
    expect(() => validateUrlShape("http://[fd00::1]/")).toThrow(UrlGuardError);
    expect(() => validateUrlShape("http://[::ffff:169.254.169.254]/")).toThrow(UrlGuardError);
  });

  it("accepts a public IPv6 literal", () => {
    expect(validateUrlShape("https://[2606:4700:4700::1111]/").protocol).toBe("https:");
  });

  it("accepts a plain public URL", () => {
    expect(validateUrlShape("https://example.com/pricing").hostname).toBe("example.com");
  });
});

describe("assertPublicUrl", () => {
  it("rejects a host that resolves to a private address", async () => {
    await expect(
      assertPublicUrl("https://evil.example.com", async () => ["169.254.169.254"]),
    ).rejects.toThrow(/interne Adresse/);
  });

  it("rejects when any resolved address is private", async () => {
    await expect(
      assertPublicUrl("https://mixed.example.com", async () => ["8.8.8.8", "10.0.0.1"]),
    ).rejects.toThrow(UrlGuardError);
  });

  it("rejects when DNS resolution fails", async () => {
    await expect(
      assertPublicUrl("https://nx.example.com", async () => {
        throw new Error("ENOTFOUND");
      }),
    ).rejects.toThrow(/aufgelöst/);
  });

  it("accepts a host resolving only to public addresses", async () => {
    const url = await assertPublicUrl("https://example.com", async () => ["93.184.216.34"]);
    expect(url.hostname).toBe("example.com");
  });
});
