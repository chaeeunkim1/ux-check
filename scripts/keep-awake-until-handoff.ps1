param([datetimeoffset]$Until = '2026-09-22T10:00:00+09:00')
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class UxCheckPowerGuard {
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern uint SetThreadExecutionState(uint flags);
}
"@
$logPath = Join-Path $PSScriptRoot '..\artifacts\private\power-guard.log'
try {
  $previousState = [UxCheckPowerGuard]::SetThreadExecutionState([uint32]2147483649)
  if ($previousState -eq 0) { throw 'Could not request temporary system wakefulness.' }
  "Started $(Get-Date -Format o), process $PID, automatic release $Until" | Add-Content -LiteralPath $logPath -Encoding utf8
  while ([datetimeoffset]::Now -lt $Until) { Start-Sleep -Seconds 30 }
} finally {
  [void][UxCheckPowerGuard]::SetThreadExecutionState([uint32]2147483648)
  "Released $(Get-Date -Format o)" | Add-Content -LiteralPath $logPath -Encoding utf8
}
