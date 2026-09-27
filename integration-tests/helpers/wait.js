/** Polls `url` until it responds (any HTTP status counts as "up") or `timeoutMs` elapses. */
export async function waitForHttp(url, { timeoutMs = 30_000, intervalMs = 300 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`Timed out waiting for ${url} to come up: ${lastError?.message}`);
}
