"""Real Docker/HTTPS checks with temporary CAs; never connects to Google or a live database."""
from __future__ import annotations
import http.server
import hashlib
import os
from pathlib import Path
import re
import shutil
import ssl
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[2]

def run(args, **kwargs):
    return subprocess.run([str(a) for a in args], check=True, **kwargs)

def issue(folder: Path, name: str):
    ca = folder / f'{name}-ca.pem'; key = folder / f'{name}-ca.key'
    run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key,
         '-out', ca, '-subj', f'/CN=DOMIX test {name}', '-days', '2',
         '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    leaf = folder / f'{name}.pem'; leaf_key = folder / f'{name}.key'; csr = folder / f'{name}.csr'
    run(['openssl', 'req', '-newkey', 'rsa:2048', '-nodes', '-keyout', leaf_key, '-out', csr,
         '-subj', '/CN=localhost'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    extension = folder / f'{name}.ext'
    extension.write_text('subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n')
    run(['openssl', 'x509', '-req', '-in', csr, '-CA', ca, '-CAkey', key, '-CAcreateserial',
         '-out', leaf, '-days', '2', '-extfile', extension], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return ca, leaf, leaf_key

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers(); self.wfile.write(b'domix-tls-ok')
    def log_message(self, *args):
        pass

def fixture(cert, key):
    server = http.server.ThreadingHTTPServer(('0.0.0.0', 0), Handler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); context.load_cert_chain(cert, key)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    return server, f'https://localhost:{server.server_port}'

def main():
    for tool in ['docker', 'dotnet', 'openssl']:
        if not shutil.which(tool): raise RuntimeError(f'{tool} is required for this integration test')
    with tempfile.TemporaryDirectory(prefix='domix-tls-') as temp:
        folder = Path(temp); ca, cert, key = issue(folder, 'trusted'); _, foreign_cert, foreign_key = issue(folder, 'foreign')
        probe = folder / 'probe'; probe.mkdir()
        (probe / 'Probe.csproj').write_text('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>')
        (probe / 'Program.cs').write_text('using System; using System.Net.Http; var handler = new HttpClientHandler { UseProxy = false }; using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(10) }; if (await client.GetStringAsync(args[0]) != "domix-tls-ok") Environment.Exit(2);')
        published = probe / 'out'
        run(['dotnet', 'publish', probe / 'Probe.csproj', '-c', 'Release', '-o', published])
        for context, label in [('auth-server', 'auth'), ('domix-server', 'api')]:
            for trusted in [False, True]:
                image = f'domix-tls-{label}-' + ('extra' if trusted else 'default')
                command = ['docker', 'build', '--tag', image]
                if trusted: command += ['--secret', f'id=extra_ca,src={ca}', '--build-arg', f'EXTRA_CA_SHA256={hashlib.sha256(ca.read_bytes()).hexdigest()}']
                run(command + [ROOT / context])
        # Verify frontend build-secret support too; its final nginx image must not receive the CA.
        run(['docker', 'build', '--secret', f'id=extra_ca,src={ca}', '--build-arg', f'EXTRA_CA_SHA256={hashlib.sha256(ca.read_bytes()).hexdigest()}', '--tag', 'domix-tls-client', ROOT / 'domix-client'])
        run(['docker', 'run', '--rm', '--entrypoint', 'sh', 'domix-tls-client', '-c', 'test ! -e /run/secrets/extra_ca && test ! -e /usr/local/share/domix/extra-ca.pem'])
        # Validate all three secret bindings in Compose with disposable, empty app env files.
        env_files = [ROOT / 'auth-server/.env', ROOT / 'domix-server/.env']
        created = []
        try:
            for path in env_files:
                if not path.exists(): path.write_text(''); created.append(path)
            environment = {**os.environ, 'EXTRA_CA_CERT': str(ca), 'LOCAL_HTTPS_CERT': str(cert), 'LOCAL_HTTPS_KEY': str(key)}
            run(['docker', 'compose', '-f', ROOT / 'docker-compose.yml', '-f', ROOT / 'docker-compose.extra-ca.yml', '-f', ROOT / 'docker-compose.local-https.yml', 'config', '--quiet'], env=environment)
        finally:
            for path in created: path.unlink()
        run(['docker', 'run', '--rm', '--add-host', 'nginx-gateway:127.0.0.1',
             '--volume', f'{ROOT / "nginx/local-https.conf"}:/etc/nginx/conf.d/default.conf:ro',
             '--volume', f'{cert}:/etc/nginx/certs/server.crt:ro', '--volume', f'{key}:/etc/nginx/certs/server.key:ro',
             'nginx:alpine', 'nginx', '-t'])
        trusted_server, trusted_url = fixture(cert, key); foreign_server, foreign_url = fixture(foreign_cert, foreign_key)
        node = 'require("https").get(process.argv[1],r=>{let s="";r.on("data",d=>s+=d);r.on("end",()=>process.exit(r.statusCode===200&&s==="domix-tls-ok"?0:2))}).on("error",e=>{console.error(e.code,e.message);process.exit(1)})'
        try:
            for label in ['auth', 'api']:
                for image_suffix, url, accepts in [('default', trusted_url, False), ('extra', trusted_url, True), ('extra', foreign_url, False)]:
                    image = f'domix-tls-{label}-{image_suffix}'
                    command = ['docker', 'run', '--rm', '--network', 'host']
                    if label == 'auth': command += [image, 'node', '-e', node, url]
                    else: command += ['--volume', f'{published}:/probe:ro', '--entrypoint', 'dotnet', image, '/probe/Probe.dll', url]
                    result = subprocess.run(command, capture_output=True, text=True, timeout=30)
                    if accepts:
                        assert result.returncode == 0, (label, image_suffix, result.stderr)
                    else:
                        assert result.returncode != 0 and re.search(r'certificate|SSL|UNABLE_TO_VERIFY|SELF_SIGNED', result.stderr, re.I), (label, image_suffix, result.stderr)
                    print(f'{label}: {image_suffix}, expected TLS acceptance={accepts}: passed', flush=True)
        finally:
            trusted_server.shutdown(); trusted_server.server_close(); foreign_server.shutdown(); foreign_server.server_close()

if __name__ == '__main__':
    main()
