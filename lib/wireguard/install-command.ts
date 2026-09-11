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
  return [
    "$ErrorActionPreference='Stop'",
    `$n='${tunnelName}'`,
    "$exe=Join-Path $env:ProgramFiles 'WireGuard\\wireguard.exe'",
    "if(-not(Test-Path -LiteralPath $exe)){throw 'Khong tim thay WireGuard'}",
    "$admin=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())",
    "if(-not $admin.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Hay chay PowerShell bang Run as Administrator'}",
    "$taskName='WireGuard Auto Start On Network'",
    "$task=Get-ScheduledTask -TaskPath '\\' -TaskName $taskName -ErrorAction SilentlyContinue",
    "if($null -ne $task){Stop-ScheduledTask -TaskPath '\\' -TaskName $taskName -ErrorAction SilentlyContinue;Start-Sleep -Seconds 2;Unregister-ScheduledTask -TaskPath '\\' -TaskName $taskName -Confirm:$false -ErrorAction Stop}",
    "$prefix='WireGuardTunnel$'",
    "$existing=@(Get-Service -Name 'WireGuardTunnel$*' -ErrorAction SilentlyContinue)",
    "foreach($service in $existing){$serviceName=$service.Name;$old=$serviceName.Substring($prefix.Length);Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue;$wgExit=-1;try{$wgProcess=Start-Process -FilePath $exe -ArgumentList @('/uninstalltunnelservice',$old) -Wait -PassThru -WindowStyle Hidden;$wgExit=$wgProcess.ExitCode}catch{};$goneLimit=(Get-Date).AddSeconds(15);do{$current=Get-Service -Name $serviceName -ErrorAction SilentlyContinue;if($null -eq $current){break};Start-Sleep -Seconds 1}while((Get-Date)-lt $goneLimit);if($null -ne $current){$scExit=-1;try{$scProcess=Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\\sc.exe') -ArgumentList @('delete',$serviceName) -Wait -PassThru -WindowStyle Hidden;$scExit=$scProcess.ExitCode}catch{};$deleteLimit=(Get-Date).AddSeconds(15);do{$current=Get-Service -Name $serviceName -ErrorAction SilentlyContinue;if($null -eq $current){break};Start-Sleep -Seconds 1}while((Get-Date)-lt $deleteLimit);if($null -ne $current){throw ('Khong the go tunnel '+$old+'. WireGuard exit='+$wgExit+', sc.exe exit='+$scExit)}}}",
    "$remaining=@(Get-Service -Name 'WireGuardTunnel$*' -ErrorAction SilentlyContinue)",
    "if($remaining.Count -ne 0){throw ('Van con WireGuard tunnel service: '+($remaining.Name -join ', '))}",
    "$d=Join-Path $env:ProgramData 'WireGuard\\Configurations'",
    "New-Item -ItemType Directory -Force -Path $d|Out-Null",
    "& icacls.exe $d /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(F)'|Out-Null",
    "if($LASTEXITCODE -ne 0){throw 'Khong the bao ve thu muc cau hinh'}",
    "$p=Join-Path $d ($n+'.conf')",
    `[IO.File]::WriteAllBytes($p,[Convert]::FromBase64String('${encoded}'))`,
    "$installProcess=Start-Process -FilePath $exe -ArgumentList @('/installtunnelservice',$p) -Wait -PassThru -WindowStyle Hidden",
    "if($installProcess.ExitCode -ne 0){throw ('Khong the cai tunnel service. Exit='+$installProcess.ExitCode)}",
    "$expected=$prefix+$n",
    "$installLimit=(Get-Date).AddSeconds(30)",
    "do{$services=@(Get-Service -Name 'WireGuardTunnel$*' -ErrorAction SilentlyContinue);if($services.Count -eq 1 -and $services[0].Name -eq $expected){break};Start-Sleep -Seconds 1}while((Get-Date)-lt $installLimit)",
    "if($services.Count -ne 1 -or $services[0].Name -ne $expected){$found=($services.Name -join ', ');if(-not $found){$found='khong co service'};throw ('Trang thai tunnel service khong hop le. Tim thay: '+$found+'. Mong doi: '+$expected)}",
  ].join(";");
}
