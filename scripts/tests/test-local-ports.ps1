$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'local-ports.ps1')
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
try {
    $busy = $listener.LocalEndpoint.Port
    $preferred = [ordered]@{ NGINX_PORT = $busy; AUTH_SERVER_PORT = $busy; DOMIX_SERVER_PORT = $busy; POSTGRES_PORT = $busy; LOCAL_HTTPS_PORT = $busy }
    $selected = Select-LocalPorts $preferred
    if (@($selected.Values | Select-Object -Unique).Count -ne 5) { throw 'Selected ports collided.' }
    if (@($selected.Values) -contains $busy) { throw 'An occupied port was selected.' }
    if (-not $listener.Server.IsBound) { throw 'The existing service was stopped.' }
    foreach ($port in $selected.Values) { if (-not (Test-LocalPortFree $port)) { throw 'An unavailable fallback was selected.' } }
    $owned = Select-LocalPorts $preferred @{ NGINX_PORT = @($busy) }
    if ($owned['NGINX_PORT'] -ne $busy) { throw 'An existing DOMIX port was unnecessarily changed.' }
    try {
        Select-LocalPorts ([ordered]@{ NGINX_PORT = 70000; AUTH_SERVER_PORT = 5000; DOMIX_SERVER_PORT = 8080; POSTGRES_PORT = 5432 })
        throw 'Invalid port was accepted.'
    } catch { if ($_.Exception.Message -notlike 'Invalid port configured*') { throw } }
    Write-Host 'Port conflict, uniqueness and own-container reuse tests passed.'
} finally { $listener.Stop() }
