# FlowTrack Backend Startup Script with Port Auto-Release
$port = 8080
$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($connections) {
    Write-Host "[FlowTrack] Port $port is in use. Stopping occupying process..." -ForegroundColor Yellow
    foreach ($conn in $connections) {
        if ($conn.OwningProcess -and $conn.OwningProcess -ne 0) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 1
}
Write-Host "[FlowTrack] Starting backend on port $port..." -ForegroundColor Green
mvn spring-boot:run
