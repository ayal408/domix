import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import app from "../app.js";

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("the Express app boots without opening a production listener on import", () => {
  assert.equal(app.get("trust proxy"), 1);
});

test("unknown routes return 404", async () => {
  const response = await fetch(`${baseUrl}/__smoke_test_not_found__`);
  assert.equal(response.status, 404);
});
