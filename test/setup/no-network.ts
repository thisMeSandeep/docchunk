// Blocks every network API before each test file runs, so any network call fails the test.
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import tls from "node:tls";
import { vi } from "vitest";

/** Returns a function that throws when called, naming the blocked API. */
function blockedApi(apiName: string): () => never {
  return function blocked(): never {
    throw new Error(`Network access is blocked in tests: ${apiName}`);
  };
}

/** Replaces the global network APIs (fetch, XMLHttpRequest, WebSocket). */
function blockGlobals(): void {
  globalThis.fetch = blockedApi("fetch");
  Object.defineProperty(globalThis, "XMLHttpRequest", { value: blockedApi("XMLHttpRequest") });
  Object.defineProperty(globalThis, "WebSocket", { value: blockedApi("WebSocket") });
}

/** Replaces the connection functions on the shared node:net, node:http, node:https, node:tls objects. */
function blockNodeModules(): void {
  net.connect = blockedApi("net.connect");
  net.createConnection = blockedApi("net.createConnection");
  // On Node, every TCP connection goes through Socket.connect, including ones made by http and tls.
  net.Socket.prototype.connect = blockedApi("net.Socket.connect");
  http.request = blockedApi("http.request");
  http.get = blockedApi("http.get");
  https.request = blockedApi("https.request");
  https.get = blockedApi("https.get");
  tls.connect = blockedApi("tls.connect");
  // On Node, makes named imports in dependencies see the replacements. Bun ignores this.
  syncBuiltinESMExports();
}

/** Returns a copy of a module with the named functions replaced by blocked ones. */
function withBlockedFunctions(
  moduleName: string,
  original: Record<string, unknown>,
  functionNames: string[],
): Record<string, unknown> {
  const blockedModule: Record<string, unknown> = { ...original };
  for (const functionName of functionNames) {
    blockedModule[functionName] = blockedApi(`${moduleName}.${functionName}`);
  }
  return blockedModule;
}

// Module mocks cover named imports in src/ and test code on both Node and Bun.
vi.mock("node:net", async (importOriginal) =>
  withBlockedFunctions("net", await importOriginal(), ["connect", "createConnection"]),
);
vi.mock("node:http", async (importOriginal) =>
  withBlockedFunctions("http", await importOriginal(), ["request", "get"]),
);
vi.mock("node:https", async (importOriginal) =>
  withBlockedFunctions("https", await importOriginal(), ["request", "get"]),
);
vi.mock("node:tls", async (importOriginal) =>
  withBlockedFunctions("tls", await importOriginal(), ["connect"]),
);

blockGlobals();
blockNodeModules();
