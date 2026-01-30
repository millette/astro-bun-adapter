import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateStaticManifest } from "./manifest.ts";
import type { StaticManifest } from "./types.ts";

function testDir() {
  const dir = join(
    tmpdir(),
    `manifest-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function readManifest(outDir: string): StaticManifest {
  return JSON.parse(
    readFileSync(join(outDir, "static-manifest.json"), "utf-8")
  );
}

describe("generateStaticManifest", () => {
  test("route headers override Cache-Control", async () => {
    const clientDir = testDir();
    const outDir = testDir();

    // Create a static file at /about/index.html → route /about
    mkdirSync(join(clientDir, "about"), { recursive: true });
    writeFileSync(join(clientDir, "about", "index.html"), "about page");

    await generateStaticManifest(clientDir, outDir, "_astro", {
      "/about": { "Cache-Control": "no-cache" },
    });

    const manifest = readManifest(outDir);
    expect(manifest["/about/index.html"].headers["Cache-Control"]).toBe(
      "no-cache"
    );
  });

  test("route headers do not override ETag or Content-Length", async () => {
    const clientDir = testDir();
    const outDir = testDir();

    writeFileSync(join(clientDir, "index.html"), "home page");

    await generateStaticManifest(clientDir, outDir, "_astro", {
      "/": { ETag: "bogus", "Content-Length": "9999" },
    });

    const manifest = readManifest(outDir);
    const headers = manifest["/index.html"].headers;

    // Content-derived values must win over route headers.
    expect(headers.ETag).not.toBe("bogus");
    expect(headers["Content-Length"]).toBe(String("home page".length));
  });

  test("route headers like CSP pass through", async () => {
    const clientDir = testDir();
    const outDir = testDir();

    writeFileSync(join(clientDir, "index.html"), "page");

    await generateStaticManifest(clientDir, outDir, "_astro", {
      "/": { "Content-Security-Policy": "default-src 'self'" },
    });

    const manifest = readManifest(outDir);
    expect(manifest["/index.html"].headers["Content-Security-Policy"]).toBe(
      "default-src 'self'"
    );
  });
});
