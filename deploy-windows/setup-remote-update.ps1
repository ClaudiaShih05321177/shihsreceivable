#requires -Version 5.1
$ErrorActionPreference = 'Stop'

$taskName = 'AR-SYSTEM Remote Update'
$firewallRuleName = 'AR-SYSTEM Remote Update SSH (local network only)'
$appDir = 'D:\SYS\AR-SYSTEM'
$updateScript = Join-Path $PSScriptRoot 'update-system.bat'
$logFile = Join-Path $PSScriptRoot 'remote-update.log'

$currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$isAdministrator = (New-Object System.Security.Principal.WindowsPrincipal($currentIdentity)).IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdministrator) {
    Write-Host 'Please run setup-remote-update.bat and approve the administrator prompt.' -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $updateScript)) {
    Write-Host "Update script not found: $updateScript" -ForegroundColor Red
    exit 1
}

try {
    Write-Host '[1/3] Enabling Windows remote connection...'
    $capability = Get-WindowsCapability -Online -Name 'OpenSSH.Server~~~~0.0.1.0'
    if ($capability.State -ne 'Installed') {
        Add-WindowsCapability -Online -Name 'OpenSSH.Server~~~~0.0.1.0' | Out-Null
    }
    Set-Service -Name 'sshd' -StartupType Automatic
    if ((Get-Service -Name 'sshd').Status -ne 'Running') {
        Start-Service -Name 'sshd'
    }

    $existingRule = Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue
    if ($null -eq $existingRule) {
        New-NetFirewallRule -DisplayName $firewallRuleName -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow -Profile Any -RemoteAddress LocalSubnet | Out-Null
    }
    else {
        $existingRule | Enable-NetFirewallRule
    }
    # Do not leave Windows' broader SSH firewall rule open to other networks.
    Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue | Disable-NetFirewallRule

    Write-Host '[2/3] Registering the on-demand update task...'
    $taskAction = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c ""{0}" --remote > "{1}" 2>&1"' -f $updateScript, $logFile) -WorkingDirectory $appDir
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId $currentIdentity.Name -LogonType Interactive -RunLevel Highest
    $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $taskName -Action $taskAction -Principal $taskPrincipal -Settings $taskSettings -Description 'Updates AR-SYSTEM and restarts the web service when requested from another company computer.' -Force | Out-Null

    Write-Host '[3/3] Checking settings...'
    if ((Get-Service -Name 'sshd').Status -ne 'Running') {
        throw 'The remote connection service did not start.'
    }
    if ($null -eq (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
        throw 'The remote update task was not registered.'
    }

    Write-Host ''
    Write-Host 'Remote update is ready.' -ForegroundColor Green
    Write-Host "Windows account for your computer: $($currentIdentity.Name)"
    Write-Host 'Company host: 192.168.0.2'
    Write-Host 'Keep this host signed in to Windows. No password was saved.'
}
catch {
    Write-Host ''
    Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Please send this screen for troubleshooting.'
    exit 1
}
