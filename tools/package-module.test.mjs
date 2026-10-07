import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { inflateRawSync } from "node:zlib";
import { ROOT } from "./project-utils.mjs";

test("package excludes missing optional assets, includes present assets, rejects a file in their place", () => {
  const fixture = mkdtempSync(join(tmpdir(), "nd-package-test-"));
  assert.equal(dirname(resolve(fixture)), resolve(tmpdir()));
  assert.ok(basename(fixture).startsWith("nd-package-test-"));
  try {
    cpSync(join(ROOT, "tools"), join(fixture, "tools"), { recursive: true });
    cpSync(join(ROOT, "module.json"), join(fixture, "module.json"));
    for (const dir of ["scripts", "styles", "templates", "lang"]) {
      mkdirSync(join(fixture, dir));
      writeFileSync(join(fixture, dir, "fixture.txt"), dir);
    }
    const build = () => spawnSync(process.execPath, ["--input-type=module", "-e",
      "import { writeDevPackage } from './tools/package-module.mjs'; writeDevPackage();"
    ], { cwd: fixture, encoding: "utf8" });
    let result = build();
    assert.equal(result.status, 0, result.stderr);
    const entries = () => {
      const zip = readFileSync(join(fixture, "build/module.zip"));
      const files = new Map();
      let offset = 0;
      while (zip.readUInt32LE(offset) === 0x04034b50) {
        const method = zip.readUInt16LE(offset + 8);
        const size = zip.readUInt32LE(offset + 18);
        const nameLength = zip.readUInt16LE(offset + 26);
        const extraLength = zip.readUInt16LE(offset + 28);
        const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString();
        const start = offset + 30 + nameLength + extraLength;
        const payload = zip.subarray(start, start + size);
        files.set(name, method === 8 ? inflateRawSync(payload) : payload);
        offset = start + size;
      }
      return files;
    };
    assert.deepEqual([...entries().keys()].sort(), ["lang/fixture.txt", "module.json", "scripts/fixture.txt", "styles/fixture.txt", "templates/fixture.txt"]);
    mkdirSync(join(fixture, "assets"));
    writeFileSync(join(fixture, "assets/marker.txt"), "asset retained");
    result = build();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(entries().get("assets/marker.txt").toString(), "asset retained");
    rmSync(join(fixture, "assets/marker.txt"));
    // fixture is a fresh, isolated temporary directory owned by this test.
    rmSync(join(fixture, "assets"), { recursive: true });
    writeFileSync(join(fixture, "assets"), "not a directory");
    result = build();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected optional directory/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
