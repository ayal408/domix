function Initialize-LocalHttps([string]$ProjectRoot, [string]$PublicUrl) {
    $certificatePath = $env:LOCAL_HTTPS_CERT
    $keyPath = $env:LOCAL_HTTPS_KEY
    if ([string]::IsNullOrWhiteSpace($certificatePath)) { $certificatePath = Join-Path $ProjectRoot '.certs/localhost.pem' }
    if ([string]::IsNullOrWhiteSpace($keyPath)) { $keyPath = Join-Path $ProjectRoot '.certs/localhost-key.pem' }
    if (-not (Test-Path -LiteralPath $certificatePath) -or -not (Test-Path -LiteralPath $keyPath)) {
        if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
            throw 'Local HTTPS needs mkcert (as in Amandex), or existing LOCAL_HTTPS_CERT and LOCAL_HTTPS_KEY files. Use HTTP mode without -Https until these are ready.'
        }
        $caRoot = & mkcert -CAROOT
        if ($LASTEXITCODE -ne 0) { throw 'mkcert could not locate its local certificate authority.' }
        $rootPem = Join-Path ([string]$caRoot) 'rootCA.pem'
        if (-not (Test-Path -LiteralPath $rootPem)) { throw 'Initialize mkcert with mkcert -install first. The script does not install a new Windows root silently.' }
        $pem = [System.IO.File]::ReadAllText($rootPem)
        $match = [regex]::Match($pem, '(?s)-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----')
        if (-not $match.Success) { throw 'The mkcert root certificate is invalid.' }
        $rootCertificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new([Convert]::FromBase64String(($match.Groups[1].Value -replace '\s', '')))
        try {
            $trusted = @(Get-ChildItem Cert:\CurrentUser\Root, Cert:\LocalMachine\Root | Where-Object { $_.Thumbprint -eq $rootCertificate.Thumbprint })
            if ($trusted.Count -eq 0) { throw 'The mkcert root is not trusted by Windows. Run mkcert -install explicitly before enabling local HTTPS.' }
        } finally { $rootCertificate.Dispose() }
        [void][System.IO.Directory]::CreateDirectory((Split-Path -Parent $certificatePath))
        [void][System.IO.Directory]::CreateDirectory((Split-Path -Parent $keyPath))
        $hostName = 'localhost'
        if (-not [string]::IsNullOrWhiteSpace($PublicUrl)) { $hostName = ([Uri]$PublicUrl).DnsSafeHost }
        & mkcert -cert-file $certificatePath -key-file $keyPath $hostName localhost 127.0.0.1 ::1
        if ($LASTEXITCODE -ne 0) { throw 'mkcert could not issue the local site certificate.' }
    }
    $env:LOCAL_HTTPS_CERT = (Resolve-Path -LiteralPath $certificatePath).Path
    $env:LOCAL_HTTPS_KEY = (Resolve-Path -LiteralPath $keyPath).Path
}
