$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ('domix-ca-test-' + [guid]::NewGuid())
[void][System.IO.Directory]::CreateDirectory($temp)
try {
    $key = [System.Security.Cryptography.RSA]::Create(2048)
    $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=DOMIX test root', $key,
        [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $false, 0, $true))
    $certificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddDays(-1), [DateTimeOffset]::UtcNow.AddDays(1))
    $pem = "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($certificate.RawData) + "`n-----END CERTIFICATE-----`n"
    $good = Join-Path $temp 'roots.pem'
    [System.IO.File]::WriteAllText($good, $pem + $pem) # Multiple roots must be accepted, not guessed as a single root.
    & pwsh -NoProfile -File (Join-Path $root 'scripts/start-local.ps1') -ExtraCaCertPath $good -ValidateOnly
    if ($LASTEXITCODE -ne 0) { throw 'Valid CA bundle was rejected.' }
    foreach ($invalid in @('not a certificate', $pem + '-----BEGIN PRIVATE KEY-----')) {
        $bad = Join-Path $temp 'bad.pem'; [System.IO.File]::WriteAllText($bad, $invalid)
        & pwsh -NoProfile -File (Join-Path $root 'scripts/start-local.ps1') -ExtraCaCertPath $bad -ValidateOnly
        if ($LASTEXITCODE -eq 0) { throw 'Invalid/private-key input was accepted.' }
    }
    $leafRequest = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=localhost', $key,
        [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $leafRequest.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true))
    $leaf = $leafRequest.CreateSelfSigned([DateTimeOffset]::UtcNow.AddDays(-1), [DateTimeOffset]::UtcNow.AddDays(1))
    $leafPath = Join-Path $temp 'leaf.pem'
    [System.IO.File]::WriteAllText($leafPath, "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($leaf.RawData) + "`n-----END CERTIFICATE-----")
    & pwsh -NoProfile -File (Join-Path $root 'scripts/start-local.ps1') -ExtraCaCertPath $leafPath -ValidateOnly
    if ($LASTEXITCODE -eq 0) { throw 'A server/leaf certificate was accepted as a CA.' }
    $global:LASTEXITCODE = 0
    Write-Host 'CA validation tests passed.'
} finally {
    if ($leaf) { $leaf.Dispose() }
    if ($certificate) { $certificate.Dispose() }
    if ($key) { $key.Dispose() }
    Remove-Item -LiteralPath $temp -Recurse -Force
}
