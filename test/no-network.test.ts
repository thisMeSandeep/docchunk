// Checks that the no-network setup blocks every network API.
import http, { request as httpRequest } from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { describe, expect, it } from "vitest";

describe("no-network setup", () => {
  it("blocks fetch", () => {
    expect(() => fetch("https://example.com")).toThrow("Network access is blocked");
  });

  it("blocks WebSocket", () => {
    expect(() => new WebSocket("wss://example.com")).toThrow("Network access is blocked");
  });

  it("blocks node:net", () => {
    expect(() => net.connect(80, "example.com")).toThrow("Network access is blocked");
    expect(() => new net.Socket().connect(80, "example.com")).toThrow("Network access is blocked");
  });

  it("blocks node:http and node:https", () => {
    expect(() => http.get("http://example.com")).toThrow("Network access is blocked");
    expect(() => https.get("https://example.com")).toThrow("Network access is blocked");
  });

  it("blocks named imports from node modules", () => {
    expect(() => httpRequest("http://example.com")).toThrow("Network access is blocked");
  });

  it("blocks node:tls", () => {
    expect(() => tls.connect(443, "example.com")).toThrow("Network access is blocked");
  });
});
