import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { waitForHttp } from "./wait.js";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");

/**
 * Starts domix-server (the .NET data API) and auth-server (the Express auth layer) as real
 * child processes against a real Postgres database, and waits for both to answer HTTP before
 * resolving — this is what makes these "integration" tests: no mocking of either service or
 * of the network calls between them.
 */
export async function startServices({ postgresUrl, domixServerPort, authServerPort }) {
  const jwtSecret = "integration-test-secret-at-least-32-characters-long";

  const domixServer = spawn("dotnet", ["run", "--no-launch-profile", "--configuration", "Release"], {
    cwd: path.join(ROOT, "domix-server"),
    env: {
      ...process.env,
      DEFAULT_CONNECTION: postgresUrl,
      JWT_SECRET: jwtSecret,
      ASPNETCORE_URLS: `http://localhost:${domixServerPort}`,
      ASPNETCORE_ENVIRONMENT: "Production",
      // No Gmail credentials in CI: EmailService logs and swallows the failure rather than
      // throwing, so registration/verification flows still complete without real email.
    },
  });
  pipeToConsole(domixServer, "domix-server");

  await waitForHttp(`http://localhost:${domixServerPort}/`);

  const authServer = spawn("node", ["app.js"], {
    cwd: path.join(ROOT, "auth-server"),
    env: {
      ...process.env,
      PORT: String(authServerPort),
      JWT_SECRET: jwtSecret,
      DATA_SERVICE_URL: `http://localhost:${domixServerPort}`,
      BCRYPT_SALT_ROUNDS: "4", // fast hashing in tests; production uses a higher cost
      NODE_ENV: "test",
      COOKIE_SAME_SITE: "lax",
    },
  });
  pipeToConsole(authServer, "auth-server");

  await waitForHttp(`http://localhost:${authServerPort}/auth/me`);

  return {
    domixServerUrl: `http://localhost:${domixServerPort}`,
    authServerUrl: `http://localhost:${authServerPort}`,
    async stop() {
      domixServer.kill("SIGTERM");
      authServer.kill("SIGTERM");
      await Promise.all([onExit(domixServer), onExit(authServer)]);
    },
  };
}

function pipeToConsole(child, label) {
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
}

function onExit(child) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once("exit", resolve));
}
