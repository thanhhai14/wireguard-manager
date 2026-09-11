import { describe, expect, it } from "vitest";
import { buildCompressedPowerShellCommand } from "./browser-powershell";

describe("compressed PowerShell command", () => {
  it("round-trips the complete script through GZip and Base64", async () => {
    const script = "Write-Host 'WireGuard'\n$giaTri = 123\n";
    const command = await buildCompressedPowerShellCommand(script);
    const encoded = command.match(/^\$b='([^']+)'/)?.[1];

    expect(encoded).toBeTruthy();
    expect(command).not.toContain(script);

    const compressed = Uint8Array.from(atob(encoded!), (value) => value.charCodeAt(0));
    const decompressed = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    const restored = await new Response(decompressed).text();

    expect(restored).toBe(script);
  });
});
