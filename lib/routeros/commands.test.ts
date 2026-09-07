import { describe, expect, it } from "vitest";
import { buildAddPeerCommand, routerOsQuote } from "./commands";

describe("RouterOS command builder", () => {
  it("escapes quoted values", () => expect(routerOsQuote('Laptop "Admin"')).toBe('"Laptop \\"Admin\\""'));
  it("rejects control characters", () => expect(() => routerOsQuote("bad\ncommand")).toThrow());
  it("builds a site-to-site peer command", () => {
    const command = buildAddPeerCommand({ interfaceName: "wg-office", publicKey: "abc=", assignedAddress: "10.0.0.2/32", remoteSubnets: ["192.168.20.0/24"], persistentKeepalive: 25, disabled: false, comment: "Branch" });
    expect(command).toContain("allowed-address=10.0.0.2/32,192.168.20.0/24");
    expect(command).toContain('interface="wg-office"');
  });
});
