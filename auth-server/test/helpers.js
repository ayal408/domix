const http = require('node:http');

// Starts the app on an ephemeral port for the duration of a test file and
// returns a small fetch-like client plus a teardown function.
function startServer(app) {
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address();
      resolve({
        request: (method, path, body, headers) => requestJson(port, method, path, body, headers),
        close: () => new Promise((res) => server.close(res)),
      });
    });
  });
}

function requestJson(port, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          const json = raw ? JSON.parse(raw) : undefined;
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = { startServer };
