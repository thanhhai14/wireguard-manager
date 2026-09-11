# ============================================================
# WIREGUARD AUTO START ON NETWORK - HANDSHAKE INSTALLER
# ============================================================

$tenTacVu = "WireGuard Auto Start On Network"
$thuMuc = "C:\ProgramData\WireGuard-AutoStart"
$fileXuLy = "$thuMuc\WireGuard-Network.ps1"
$wgExe = "$env:ProgramFiles\WireGuard\wg.exe"

Write-Host ""
Write-Host "=== CAI DAT WIREGUARD AUTO START ===" -ForegroundColor Cyan

$doiTuongNguoiDung = New-Object Security.Principal.WindowsPrincipal(
    [Security.Principal.WindowsIdentity]::GetCurrent()
)

if (-not $doiTuongNguoiDung.IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)) {
    Write-Host "Hay chay PowerShell bang Run as Administrator." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $wgExe)) {
    Write-Host "Khong tim thay wg.exe tai $wgExe." -ForegroundColor Red
    Write-Host "Hay cai dat WireGuard truoc khi chay script."
    exit 1
}

New-Item -ItemType Directory -Path $thuMuc -Force | Out-Null

$noiDungXuLy = @'
# ============================================================
# WireGuard Network Watchdog - Handshake Check
# ============================================================

$wgExe = "$env:ProgramFiles\WireGuard\wg.exe"
$fileLog = "C:\ProgramData\WireGuard-AutoStart\WireGuard-AutoStart.log"
$tienToDichVu = 'WireGuardTunnel$'

$choNetwork = 5
$nguongHandshakeHopLe = 180
$choHandshakeMoiToiDa = 40
$chuKyKiemTraHandshake = 5
$choTruocKhiRestart = 5
$soLanRestartToiDa = 3

function Ghi-Log {
    param([string]$noiDung)
    $thoiGian = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$thoiGian - $noiDung" |
        Out-File -FilePath $fileLog -Append -Encoding UTF8
}

function Lay-ThoiGianUnix {
    return [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
}

function Lay-HandshakeMoiNhat {
    param([string]$tenTunnel)

    $ketQua = & $wgExe show $tenTunnel latest-handshakes 2>&1
    if ($LASTEXITCODE -ne 0) {
        Ghi-Log "Khong doc duoc handshake cua $($tenTunnel): $ketQua"
        return [long]0
    }

    $handshakeMoiNhat = [long]0
    foreach ($dong in @($ketQua)) {
        $cacPhan = ([string]$dong).Trim() -split '\s+'
        if ($cacPhan.Count -lt 2) {
            continue
        }

        $dauThoiGian = [long]0
        if ([long]::TryParse($cacPhan[-1], [ref]$dauThoiGian)) {
            if ($dauThoiGian -gt $handshakeMoiNhat) {
                $handshakeMoiNhat = $dauThoiGian
            }
        }
    }

    return $handshakeMoiNhat
}

function Kiem-Tra-HandshakeGanDay {
    param([string]$tenTunnel)

    $handshakeMoiNhat = Lay-HandshakeMoiNhat -tenTunnel $tenTunnel
    if ($handshakeMoiNhat -le 0) {
        Ghi-Log "Tunnel $($tenTunnel): chua co handshake."
        return $false
    }

    $tuoiHandshake = (Lay-ThoiGianUnix) - $handshakeMoiNhat
    Ghi-Log "Tunnel $($tenTunnel): handshake=$handshakeMoiNhat, age=$tuoiHandshake giay."

    return (
        $tuoiHandshake -ge 0 -and
        $tuoiHandshake -le $nguongHandshakeHopLe
    )
}

function Cho-HandshakeMoi {
    param(
        [string]$tenTunnel,
        [long]$mocThoiGian
    )

    $thoiGianKetThuc = (Get-Date).AddSeconds($choHandshakeMoiToiDa)
    while ((Get-Date) -lt $thoiGianKetThuc) {
        $handshakeMoiNhat = Lay-HandshakeMoiNhat -tenTunnel $tenTunnel

        if ($handshakeMoiNhat -gt 0) {
            $tuoiHandshake = (Lay-ThoiGianUnix) - $handshakeMoiNhat
            Ghi-Log "Tunnel $($tenTunnel): handshake=$handshakeMoiNhat, age=$tuoiHandshake giay."

            if ($handshakeMoiNhat -ge ($mocThoiGian - 5)) {
                return $true
            }
        }
        else {
            Ghi-Log "Tunnel $($tenTunnel): chua co handshake moi."
        }

        Start-Sleep -Seconds $chuKyKiemTraHandshake
    }

    return $false
}

function Cho-Service-Running {
    param([System.ServiceProcess.ServiceController]$dichVu)

    $dichVu.Refresh()
    $dichVu.WaitForStatus(
        [System.ServiceProcess.ServiceControllerStatus]::Running,
        [TimeSpan]::FromSeconds(20)
    )
}

Ghi-Log "================================================"
Ghi-Log "Network Connected - bat dau xu ly WireGuard."

$mutex = New-Object System.Threading.Mutex(
    $false,
    "Global\WireGuardAutoStartOnNetwork"
)
$giuMutex = $false

try {
    try {
        $giuMutex = $mutex.WaitOne(0)
    }
    catch [System.Threading.AbandonedMutexException] {
        $giuMutex = $true
    }

    if (-not $giuMutex) {
        Ghi-Log "Watchdog khac dang chay. Bo qua lan nay."
        exit 0
    }

    Ghi-Log "Cho $choNetwork giay de network on dinh."
    Start-Sleep -Seconds $choNetwork

    if (-not (Test-Path $wgExe)) {
        Ghi-Log "Khong tim thay wg.exe tai $wgExe."
        exit 2
    }

    $danhSachDichVu = @(
        Get-Service -Name 'WireGuardTunnel$*' -ErrorAction SilentlyContinue
    )

    if ($danhSachDichVu.Count -eq 0) {
        Ghi-Log "Khong tim thay WireGuardTunnel service."
        exit 2
    }

    Ghi-Log "Tim thay $($danhSachDichVu.Count) WireGuard tunnel."

    $soTunnelThanhCong = 0
    $soTunnelThatBai = 0

    foreach ($dichVu in $danhSachDichVu) {
        $tenTunnel = $dichVu.Name.Substring($tienToDichVu.Length)

        Ghi-Log "------------------------------------------------"
        Ghi-Log "Bat dau kiem tra tunnel: $tenTunnel"
        Ghi-Log "Service: $($dichVu.Name)"

        $dichVu.Refresh()
        $tunnelThanhCong = $false

        if ($dichVu.Status -eq "Running") {
            Ghi-Log "Service $($dichVu.Name) dang Running."

            if (Kiem-Tra-HandshakeGanDay -tenTunnel $tenTunnel) {
                Ghi-Log "Tunnel $($tenTunnel): HANDSHAKE GAN DAY OK."
                $tunnelThanhCong = $true
            }
            else {
                Ghi-Log "Tunnel $($tenTunnel): handshake cu hoac khong ton tai."
                Ghi-Log "Cho handshake moi truoc khi quyet dinh restart."

                $mocBatDauCho = Lay-ThoiGianUnix
                $tunnelThanhCong = Cho-HandshakeMoi `
                    -tenTunnel $tenTunnel `
                    -mocThoiGian $mocBatDauCho
            }
        }
        else {
            try {
                $mocBatDau = Lay-ThoiGianUnix
                Ghi-Log "Service dang $($dichVu.Status) -> Start-Service."

                Start-Service -Name $dichVu.Name -ErrorAction Stop
                Cho-Service-Running -dichVu $dichVu

                Ghi-Log "Start service thanh cong, cho handshake moi."
                $tunnelThanhCong = Cho-HandshakeMoi `
                    -tenTunnel $tenTunnel `
                    -mocThoiGian $mocBatDau
            }
            catch {
                Ghi-Log "Start service loi: $($_.Exception.Message)"
            }
        }

        for (
            $lanRestart = 1;
            -not $tunnelThanhCong -and $lanRestart -le $soLanRestartToiDa;
            $lanRestart++
        ) {
            Ghi-Log "Cho $choTruocKhiRestart giay truoc khi restart."
            Start-Sleep -Seconds $choTruocKhiRestart

            try {
                $mocRestart = Lay-ThoiGianUnix
                Ghi-Log "Restart service $($dichVu.Name), lan $lanRestart/$soLanRestartToiDa."

                Restart-Service -Name $dichVu.Name -Force -ErrorAction Stop
                Cho-Service-Running -dichVu $dichVu

                Ghi-Log "Restart service thanh cong, cho handshake moi."
                $tunnelThanhCong = Cho-HandshakeMoi `
                    -tenTunnel $tenTunnel `
                    -mocThoiGian $mocRestart
            }
            catch {
                Ghi-Log "Restart service loi: $($_.Exception.Message)"
            }
        }

        if ($tunnelThanhCong) {
            Ghi-Log "Tunnel $($tenTunnel): HANDSHAKE OK."
            $soTunnelThanhCong++
        }
        else {
            Ghi-Log "Tunnel $($tenTunnel): THAT BAI."
            $soTunnelThatBai++
        }
    }

    Ghi-Log "------------------------------------------------"
    Ghi-Log "Hoan tat. Thanh cong: $soTunnelThanhCong. That bai: $soTunnelThatBai."

    if ($soTunnelThatBai -gt 0) {
        exit 1
    }

    exit 0
}
finally {
    if ($giuMutex) {
        $mutex.ReleaseMutex()
    }

    $mutex.Dispose()
}
'@

Set-Content `
    -Path $fileXuLy `
    -Value $noiDungXuLy `
    -Encoding UTF8

Write-Host "Da tao watchdog:" -ForegroundColor Green
Write-Host "  $fileXuLy"

Write-Host ""
Write-Host "Xoa Scheduled Task cu neu ton tai..."

schtasks.exe /Delete `
    /TN "$tenTacVu" `
    /F 2>$null | Out-Null

Write-Host "Tao Scheduled Task..."

$lenhChay = 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\ProgramData\WireGuard-AutoStart\WireGuard-Network.ps1"'

schtasks.exe /Create `
    /TN "$tenTacVu" `
    /SC ONEVENT `
    /EC "Microsoft-Windows-NetworkProfile/Operational" `
    /MO "*[System[(EventID=10000)]]" `
    /TR "$lenhChay" `
    /RU SYSTEM `
    /RL HIGHEST `
    /F

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "LOI: Khong tao duoc Scheduled Task." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== CAI DAT THANH CONG ===" -ForegroundColor Green
Write-Host ""
Write-Host "Task:"
Write-Host "  $tenTacVu"
Write-Host ""
Write-Host "Trigger:"
Write-Host "  NetworkProfile Event ID 10000"
Write-Host ""
Write-Host "Watchdog:"
Write-Host "  $fileXuLy"
Write-Host ""
Write-Host "Log:"
Write-Host "  $thuMuc\WireGuard-AutoStart.log"
Write-Host ""
Write-Host "WireGuard Tunnel:"

Get-Service -Name 'WireGuardTunnel$*' -ErrorAction SilentlyContinue |
    Format-Table Status, Name, DisplayName -AutoSize

Write-Host ""
Write-Host "Chay thu watchdog bang lenh:" -ForegroundColor Cyan
Write-Host "  Start-ScheduledTask -TaskName `"$tenTacVu`""
Write-Host ""
Write-Host "Xem log bang lenh:" -ForegroundColor Cyan
Write-Host "  Get-Content `"$thuMuc\WireGuard-AutoStart.log`" -Wait"
