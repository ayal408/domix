[CmdletBinding()]
param(
    [string]$ExtraCaCertPath = $env:EXTRA_CA_CERT,
    [string[]]$AdditionalComposeFiles = @(),
    [string]$PublicUrl = $env:DOMIX_LOCAL_CLIENT_URL,
    [switch]$Https,
    [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'local-ports.ps1')
. (Join-Path $PSScriptRoot 'local-https.ps1')

function Assert-CaBundle([string]$Path) {
    $text = [System.IO.File]::ReadAllText($Path)
    if ($text -match 'PRIVATE KEY') { throw 'The CA bundle must not contain a private key.' }
    $blocks = [regex]::Matches($text, '(?s)-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----')
    if ($blocks.Count -eq 0) { throw 'No PEM certificates were found. Supply a root CA PEM/CRT bundle.' }
    foreach ($block in $blocks) {
        $der = [Convert]::FromBase64String(($block.Groups[1].Value -replace '\s', ''))
        $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($der)
        try {
            $extension = @($certificate.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.19' })
            if ($extension.Count -ne 1) { throw 'Every supplied certificate must be a CA certificate.' }
            $constraints = [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($extension[0], $extension[0].Critical)
            if (-not $constraints.CertificateAuthority) { throw 'A leaf/server certificate cannot be used as a root CA.' }
            if ($certificate.NotAfter -lt (Get-Date) -or $certificate.NotBefore -gt (Get-Date)) {
                throw 'The CA bundle contains an expired or not-yet-valid certificate.'
            }
        } finally { $certificate.Dispose() }
    }
    return $blocks.Count
}

try {
    if ([string]::IsNullOrWhiteSpace($ExtraCaCertPath)) {
        # Export only certificates already trusted by Windows, never guess from a downloaded file.
        $roots = @(Get-ChildItem Cert:\CurrentUser\Root, Cert:\LocalMachine\Root |
            Where-Object { $_.Subject -match 'NetFree' -and $_.Subject -eq $_.Issuer -and
                $_.NotAfter -gt (Get-Date) -and $_.NotBefore -lt (Get-Date) } |
            Sort-Object Thumbprint -Unique)
        if ($roots.Count -eq 0) {
            throw 'No trusted NetFree root was found in Windows. Install the official NetFree certificate, or pass -ExtraCaCertPath with your trusted CA PEM file.'
        }
        $folder = Join-Path $projectRoot '.local\certs'
        [void][System.IO.Directory]::CreateDirectory($folder)
        $ExtraCaCertPath = Join-Path $folder 'netfree-ca.pem'
        $pem = ($roots | ForEach-Object {
            "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($_.RawData, [Base64FormattingOptions]::InsertLineBreaks) + "`n-----END CERTIFICATE-----`n"
        }) -join "`n"
        [System.IO.File]::WriteAllText($ExtraCaCertPath, $pem, [System.Text.UTF8Encoding]::new($false))
    }
    $ExtraCaCertPath = (Resolve-Path -LiteralPath $ExtraCaCertPath).Path
    $count = Assert-CaBundle $ExtraCaCertPath
    Write-Host "Validated $count CA certificate(s). TLS verification remains enabled."
    if ($ValidateOnly) { exit 0 }
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop is required. Start Docker Desktop and run this script again.' }
    foreach ($file in @('auth-server/.env', 'domix-server/.env')) {
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $file))) {
            throw "Missing $file. Create it from the matching .env.example and configure the application first."
        }
    }
    $env:EXTRA_CA_CERT = $ExtraCaCertPath
    $env:EXTRA_CA_SHA256 = (Get-FileHash -LiteralPath $ExtraCaCertPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $compose = @('compose', '--project-directory', $projectRoot, '-f', (Join-Path $projectRoot 'docker-compose.yml'))
    # Preserve the conventional local override; explicit extra overlays can also be passed by name.
    $override = Join-Path $projectRoot 'docker-compose.override.yml'
    if (Test-Path -LiteralPath $override) { $compose += @('-f', $override) }
    foreach ($file in $AdditionalComposeFiles) { $compose += @('-f', (Resolve-Path -LiteralPath $file).Path) }
    $useHttps = [bool]$Https -or @($AdditionalComposeFiles | Where-Object { [System.IO.Path]::GetFileName($_) -eq 'docker-compose.local-https.yml' }).Count -gt 0
    if ($useHttps) { Initialize-LocalHttps $projectRoot $PublicUrl }
    $compose += @('-f', (Join-Path $projectRoot 'docker-compose.local.yml'))
    $httpsOverlay = Join-Path $projectRoot 'docker-compose.local-https.yml'
    if ($useHttps -and $compose -notcontains $httpsOverlay) { $compose += @('-f', $httpsOverlay) }
    $compose += @('-f', (Join-Path $projectRoot 'docker-compose.extra-ca.yml'))
    $preferred = [ordered]@{ NGINX_PORT = 80; AUTH_SERVER_PORT = 5000; DOMIX_SERVER_PORT = 8080; POSTGRES_PORT = 5432 }
    if ($useHttps) { $preferred['LOCAL_HTTPS_PORT'] = 443 }
    $urlPortName = 'NGINX_PORT'; $urlScheme = 'http'; $standardPort = 80
    if ($useHttps) { $urlPortName = 'LOCAL_HTTPS_PORT'; $urlScheme = 'https'; $standardPort = 443 }
    $statePath = Join-Path $projectRoot '.local/ports.json'
    if (Test-Path -LiteralPath $statePath) {
        $previous = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        foreach ($name in @($preferred.Keys)) {
            if ($previous.Ports.PSObject.Properties.Name -contains $name) { $preferred[$name] = $previous.Ports.$name }
        }
    } else {
        $rootEnv = Join-Path $projectRoot '.env'
        if (Test-Path -LiteralPath $rootEnv) {
            foreach ($line in [System.IO.File]::ReadAllLines($rootEnv)) {
                if ($line -match '^\s*(NGINX_PORT|AUTH_SERVER_PORT|DOMIX_SERVER_PORT|POSTGRES_PORT|LOCAL_HTTPS_PORT)\s*=\s*([0-9]+)\s*(?:#.*)?$') {
                    $preferred[$Matches[1]] = $Matches[2]
                }
            }
        }
    }
    foreach ($name in @($preferred.Keys)) {
        $configured = [Environment]::GetEnvironmentVariable($name)
        if (-not [string]::IsNullOrWhiteSpace($configured)) { $preferred[$name] = $configured }
    }
    # localhost is derived again each run; do not accidentally reuse a stale automatic URL.
    $automaticUrl = [string]::IsNullOrWhiteSpace($PublicUrl)
    $servicePorts = @{ NGINX_PORT = @('nginx-gateway', '80/tcp'); AUTH_SERVER_PORT = @('auth-server', '5000/tcp'); DOMIX_SERVER_PORT = @('domix-server', '8080/tcp'); POSTGRES_PORT = @('postgres', '5432/tcp'); LOCAL_HTTPS_PORT = @('local-https', '443/tcp') }
    for ($retry = 0; $retry -lt 3; $retry++) {
        # Compose needs a URL while inspecting existing containers, before choosing the final port.
        if ($automaticUrl) { $env:DOMIX_LOCAL_CLIENT_URL = $urlScheme + '://localhost:' + $preferred[$urlPortName] }
        else {
            $uri = $null
            if (-not [Uri]::TryCreate($PublicUrl, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -notin @('http', 'https')) { throw 'PublicUrl must be an absolute http/https URL.' }
            $env:DOMIX_LOCAL_CLIENT_URL = $PublicUrl.TrimEnd('/')
        }
        & docker @compose config --quiet
        if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration validation failed.' }
        $owned = @{}
        foreach ($name in @($preferred.Keys)) {
            $service = $servicePorts[$name][0]; $internalPort = $servicePorts[$name][1]
            $containers = @(& docker @compose ps -q $service)
            if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect existing DOMIX containers. Check Docker Desktop.' }
            foreach ($container in $containers) {
                if ([string]::IsNullOrWhiteSpace($container)) { continue }
                $ports = (& docker inspect --format '{{json .NetworkSettings.Ports}}' $container) | ConvertFrom-Json
                if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect Docker port ownership.' }
                if ($null -ne $ports -and $ports.PSObject.Properties.Name -contains $internalPort) {
                    foreach ($binding in @($ports.$internalPort)) {
                        if ($null -ne $binding) { $owned[$name] = @($owned[$name]) + [int]$binding.HostPort }
                    }
                }
            }
        }
        $selected = Select-LocalPorts $preferred $owned
        foreach ($name in @($selected.Keys)) {
            [Environment]::SetEnvironmentVariable($name, [string]$selected[$name], 'Process')
            if ($selected[$name] -ne [int]$preferred[$name]) { Write-Host "$name was unavailable; using $($selected[$name])." }
        }
        if ($automaticUrl) {
            $env:DOMIX_LOCAL_CLIENT_URL = $urlScheme + '://localhost'
            if ($selected[$urlPortName] -ne $standardPort) { $env:DOMIX_LOCAL_CLIENT_URL += ':' + $selected[$urlPortName] }
        }
        & docker @compose up -d --build
        if ($LASTEXITCODE -eq 0) {
            if ($useHttps) {
                & docker @compose restart local-https
                if ($LASTEXITCODE -ne 0) { throw 'The local HTTPS proxy could not restart. Check its certificate and upstream.' }
            }
            [void][System.IO.Directory]::CreateDirectory((Split-Path -Parent $statePath))
            $state = @{ Ports = $selected; Url = $env:DOMIX_LOCAL_CLIENT_URL } | ConvertTo-Json
            [System.IO.File]::WriteAllText($statePath, $state, [System.Text.UTF8Encoding]::new($false))
            Write-Host "DOMIX: $env:DOMIX_LOCAL_CLIENT_URL"
            Write-Host 'If the site port changed, authorize this exact origin in your Google OAuth client.'
            exit 0
        }
        # A process can claim a port between probing and Docker binding. Retry only for a real new conflict.
        $conflict = $false
        foreach ($name in @($selected.Keys)) {
            $wasOwned = $owned.ContainsKey($name) -and @($owned[$name]) -contains $selected[$name]
            if (-not $wasOwned -and -not (Test-LocalPortFree $selected[$name])) { $conflict = $true }
        }
        if (-not $conflict) { throw 'Docker startup failed. Check the build/service error above.' }
        $preferred = $selected
        Write-Host 'A port changed availability during startup; selecting ports again.'
    }
    throw 'Ports remained busy after three attempts. No other process was stopped.'

} catch {
    Write-Error $_.Exception.Message -ErrorAction Continue
    exit 1
}
