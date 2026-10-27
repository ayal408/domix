# Pure port selection helpers; dot-sourcing this file does not start Docker or change settings.
function Test-LocalPortFree([int]$Port) {
    $listeners = @()
    try {
        $v4 = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $listeners += $v4; $v4.Server.ExclusiveAddressUse = $true; $v4.Start()
        if ([System.Net.Sockets.Socket]::OSSupportsIPv6) {
            $v6 = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::IPv6Any, $Port)
            $listeners += $v6; $v6.Server.DualMode = $false
            $v6.Server.ExclusiveAddressUse = $true; $v6.Start()
        }
        return $true
    } catch [System.Net.Sockets.SocketException] {
        return $false
    } finally {
        foreach ($listener in $listeners) { $listener.Stop() }
    }
}

function Select-LocalPorts([System.Collections.IDictionary]$Preferred, [hashtable]$Owned = @{}) {
    $selected = [ordered]@{}
    $reserved = [System.Collections.Generic.HashSet[int]]::new()
    foreach ($name in @($Preferred.Keys)) {
        $preferredPort = 0
        if (-not [int]::TryParse([string]$Preferred[$name], [ref]$preferredPort) -or $preferredPort -lt 1 -or $preferredPort -gt 65535) {
            throw "Invalid port configured for $name. Use an integer between 1 and 65535."
        }
        $candidate = $preferredPort
        $found = $false
        for ($attempt = 0; $attempt -lt 65535; $attempt++) {
            $isOwned = $Owned.ContainsKey($name) -and @($Owned[$name]) -contains $candidate
            if (-not $reserved.Contains($candidate) -and ($isOwned -or (Test-LocalPortFree $candidate))) { $found = $true; break }
            if ($attempt -eq 0 -and ($preferredPort -eq 80 -or $preferredPort -eq 443)) { $candidate = 8081 }
            else { $candidate++ }
            if ($candidate -gt 65535) { $candidate = 1024 }
        }
        if (-not $found) { throw "No available TCP port could be selected for $name." }
        $selected[$name] = $candidate
        [void]$reserved.Add($candidate)
    }
    return $selected
}
