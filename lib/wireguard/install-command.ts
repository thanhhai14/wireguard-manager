import { Buffer } from "node:buffer";

export function buildClientTunnelName(peerName: string, peerId: string) {
  const name = peerName
    .normalize("NFKD")
    .replace(/[đĐ]/g, (value) => value === "Đ" ? "D" : "d")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-zA-Z0-9_=+.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 7)
    .replace(/-+$/g, "") || "client";
  const suffix = peerId.replace(/[^a-fA-F0-9]/g, "").slice(0, 4).toLowerCase() || "0000";
  return `wg-${name}-${suffix}`;
}

function encodedConfig(config: string) {
  return Buffer.from(config, "utf8").toString("base64");
}

export function buildLinuxInstallCommand(config: string, tunnelName: string) {
  const path = `/etc/wireguard/${tunnelName}.conf`;
  return `(sudo wg-quick down '${tunnelName}' >/dev/null 2>&1 || true) && printf '%s' '${encodedConfig(config)}' | base64 -d | sudo tee '${path}' >/dev/null && sudo chmod 600 '${path}' && sudo wg-quick up '${tunnelName}'`;
}

export function buildWindowsInstallCommand(config: string, tunnelName: string) {
  const encoded = encodedConfig(config);
  return `$n='${tunnelName}';$exe=Join-Path $env:ProgramFiles 'WireGuard\\wireguard.exe';$d=Join-Path $env:ProgramData 'WireGuard\\Configurations';if(Get-Service -Name ('WireGuardTunnel$'+$n) -ErrorAction SilentlyContinue){& $exe /uninstalltunnelservice $n};New-Item -ItemType Directory -Force -Path $d|Out-Null;& icacls.exe $d /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(F)'|Out-Null;$p=Join-Path $d ($n+'.conf');[IO.File]::WriteAllBytes($p,[Convert]::FromBase64String('${encoded}'));& $exe /installtunnelservice $p`;
}
