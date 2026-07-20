$r = Invoke-WebRequest -Uri 'http://localhost:3000/year' -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
if ($r) {
    Write-Host $r.StatusCode
} else {
    Write-Host 'Server not responding'
}