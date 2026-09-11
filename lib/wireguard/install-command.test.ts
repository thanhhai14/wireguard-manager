import { describe, expect, it } from "vitest";
import { buildClientTunnelName, buildLinuxInstallCommand, buildWindowsInstallCommand } from "./install-command";

const config = "[Interface]\nPrivateKey = secret=\n";

describe("WireGuard client install commands", () => {
  it("builds a Linux-safe interface name no longer than 15 characters", () => {
    const name = buildClientTunnelName("Máy kế toán số 01", "a1b2c3d4-0000-0000-0000-000000000000");
    expect(name).toMatch(/^[a-zA-Z0-9_=+.-]{1,15}$/);
    expect(name).toBe("wg-May-ke-a1b2");
  });

  it("embeds the config and activates it with wg-quick on Linux", () => {
    const command = buildLinuxInstallCommand(config, "wg-client-a1b2");
    expect(command).not.toContain("PrivateKey = secret=");
    expect(command).toContain("base64 -d");
    expect(command).toContain("chmod 600 '/etc/wireguard/wg-client-a1b2.conf'");
    expect(command).toContain("wg-quick up 'wg-client-a1b2'");
  });

  it("installs a protected tunnel service on Windows", () => {
    const command = buildWindowsInstallCommand(config, "wg-client-a1b2");
    expect(command).not.toContain("PrivateKey = secret=");
    expect(command).toContain("WireGuard\\wireguard.exe");
    expect(command).toContain("Get-Service -Name 'WireGuardTunnel$*'");
    expect(command).toContain("/uninstalltunnelservice $old");
    expect(command).toContain("Van con WireGuard tunnel service");
    expect(command).toContain("/installtunnelservice $p");
    expect(command).toContain("AddSeconds(30)");
    expect(command).toContain("Tim thay:");
    expect(command).toContain("Mong doi:");
    expect(command).toContain("icacls.exe");
    expect(command.indexOf("/uninstalltunnelservice $old")).toBeLessThan(command.indexOf("/installtunnelservice $p"));
  });
});
