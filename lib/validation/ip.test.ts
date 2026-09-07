import { describe, expect, it } from "vitest";
import { cidrsOverlap, isPrivateCidr, isUsableHostInCidr, nextAvailableIp, parseCidr } from "./ip";

describe("IPv4 validation", () => {
  it("normalizes CIDR and recognizes private ranges", () => {
    expect(parseCidr("192.168.10.42/24").normalized).toBe("192.168.10.0/24");
    expect(isPrivateCidr("172.16.20.0/24")).toBe(true);
    expect(isPrivateCidr("8.8.8.0/24")).toBe(false);
  });

  it("detects overlap", () => {
    expect(cidrsOverlap("10.0.0.0/24", "10.0.0.128/25")).toBe(true);
    expect(cidrsOverlap("10.0.0.0/24", "10.0.1.0/24")).toBe(false);
  });

  it("validates and allocates host addresses", () => {
    expect(isUsableHostInCidr("10.0.0.2/32", "10.0.0.0/24")).toBe(true);
    expect(isUsableHostInCidr("10.0.0.0/32", "10.0.0.0/24")).toBe(false);
    expect(nextAvailableIp("10.0.0.0/29", ["10.0.0.1/32", "10.0.0.2/32"])).toBe("10.0.0.3/32");
  });
});
