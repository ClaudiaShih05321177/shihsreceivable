#requires -Version 5.1
$ErrorActionPreference = 'Stop'

$taskName = 'AR-SYSTEM Remote Update'
$logFile = Join-Path $PSScriptRoot 'remote-update.log'
$deadline = (Get-Date).AddMinutes(30)

try {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
    $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
    $previousRunTime = $taskInfo.LastRunTime
    $updateStarted = $task.State -eq 'Running'
    if ($updateStarted) {
        Write-Host 'An update is already running. Waiting for it to finish...'
    }
    else {
        Write-Host 'Starting the company host update...'
        Start-ScheduledTask -TaskName $taskName
    }

    # Start-ScheduledTask returns before the task has finished. Confirm that
    # this is a new run so an older successful result is never reported.
    do {
        if ((Get-Date) -gt $deadline) {
            throw 'The update did not finish within 30 minutes. Please check the company host.'
        }
        Start-Sleep -Seconds 3
        $task = Get-ScheduledTask -TaskName $taskName
        $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
        if (-not $updateStarted) {
            $updateStarted = $task.State -eq 'Running' -or $taskInfo.LastRunTime -gt $previousRunTime
            if (-not $updateStarted) {
                Write-Host 'Waiting for the company host to start the update...'
                continue
            }
        }
        if ($task.State -ne 'Running') {
            break
        }
        Write-Host 'Updating packages and restarting the web service...'
    } while ($true)
    if (-not $updateStarted) {
        throw 'The company host did not start the update task.'
    }
    if (Test-Path $logFile) {
        Write-Host ''
        Write-Host '--- Company host update details ---'
        Get-Content -Path $logFile
        Write-Host '--- End of update details ---'
        Write-Host ''
    }
    if ($taskInfo.LastTaskResult -ne 0) {
        throw "The update failed (result $($taskInfo.LastTaskResult)). Please send the details above for troubleshooting."
    }

    Write-Host 'Checking that the web service is available...'
    $webReady = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3001' -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                $webReady = $true
                break
            }
        }
        catch {
            # The web service can need a few seconds to start.
        }
        Start-Sleep -Seconds 3
    }
    if (-not $webReady) {
        throw 'The update finished, but the web service did not respond on port 3001.'
    }

    Write-Host 'Update complete. Open http://192.168.0.2:3001 and press Ctrl+F5.' -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
