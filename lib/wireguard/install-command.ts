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
  return `$ErrorActionPreference='Stop';$n='${tunnelName}';$exe=Join-Path $env:ProgramFiles 'WireGuard\\wireguard.exe';if(-not(Test-Path -LiteralPath $exe)){throw 'Khong tim thay WireGuard'};$prefix='WireGuardTunnel$';@(Get-Service -Name 'WireGuardTunnel$*' -ErrorAction SilentlyContinue)|ForEach-Object{$old=$_.Name.Substring($prefix.Length);& $exe /uninstalltunnelservice $old;if($LASTEXITCODE -ne 0){throw ('Khong the go tunnel '+$old)}};$limit=(Get-Date).AddSeconds(15);do{$remaining=@(Get-Service -Name 'WireGuardTunnel$*' -ErrorAction SilentlyContinue);if($remaining.Count -eq 0){break};Start-Sleep -Seconds 1}while((Get-Date)-lt $limit);if($remaining.Count -ne 0){throw 'Van con WireGuard tunnel service'};$d=Join-Path $env:ProgramData 'WireGuard\\Configurations';New-Item -ItemType Directory -Force -Path $d|Out-Null;& icacls.exe $d /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(F)'|Out-Null;if($LASTEXITCODE -ne 0){throw 'Khong the bao ve thu muc cau hinh'};$p=Join-Path $d ($n+'.conf');[IO.File]::WriteAllBytes($p,[Convert]::FromBase64String('${encoded}'));& $exe /installtunnelservice $p;if($LASTEXITCODE -ne 0){throw 'Khong the cai tunnel service'};$services=@(Get-Service -Name 'WireGuardTunnel$*' -ErrorAction SilentlyContinue);if($services.Count -ne 1 -or $services[0].Name -ne ($prefix+$n)){throw 'Trang thai tunnel service khong hop le'}`;
}
