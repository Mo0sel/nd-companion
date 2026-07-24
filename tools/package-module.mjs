/**
 * Build a flat Foundry module.zip (no wrapper folder) using store+deflate.
 * Pure Node — no external zip binary required.
 */

import { createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { deflateRawSync } from "node:zlib";
import {
  BUILD_DIR,
  MODULE_JSON,
  PACKAGE_DIRS,
  PACKAGE_OPTIONAL_DIRS,
  ROOT,
  fail,
  listFilesRecursive,
  posixPath,
  readModuleJson
} from "./project-utils.mjs";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value, 0);
  return buf;
}

function u32(value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

/**
 * @param {{ name: string, data: Buffer }[]} files
 * @returns {Buffer}
 */
export function buildZipBuffer(files) {
  /** @type {Buffer[]} */
  const locals = [];
  /** @type {Buffer[]} */
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name.replace(/\\/g, "/"), "utf8");
    const data = file.data;
    const compressed = deflateRawSync(data);
    const useStore = compressed.length >= data.length;
    const payload = useStore ? data : compressed;
    const method = useStore ? 0 : 8;
    const crc = crc32(data);

    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      payload
    ]);

    const central = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name
    ]);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralSize),
    u32(offset),
    u16(0)
  ]);

  return Buffer.concat([...locals, ...centrals, end]);
}

/**
 * Collect whitelist package files from the repo root.
 * @returns {{ name: string, data: Buffer }[]}
 */
export function collectPackageFiles() {
  /** @type {{ name: string, data: Buffer }[]} */
  const files = [];
  files.push({
    name: "module.json",
    data: readFileSync(MODULE_JSON)
  });

  for (const dir of PACKAGE_DIRS) {
    const abs = join(ROOT, dir);
    for (const file of listFilesRecursive(abs)) {
      files.push({
        name: posixPath(file),
        data: readFileSync(file)
      });
    }
  }

  for (const dir of PACKAGE_OPTIONAL_DIRS) {
    const abs = join(ROOT, dir);
    try {
      for (const file of listFilesRecursive(abs)) {
        files.push({
          name: posixPath(file),
          data: readFileSync(file)
        });
      }
    } catch {
      // optional
    }
  }

  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
}

/**
 * Write build/module.json + build/module.zip for local Foundry testing.
 * Does not mutate the repo module.json version or URLs.
 * @param {{ outDir?: string }} [options]
 */
export function writeDevPackage(options = {}) {
  const outDir = options.outDir || BUILD_DIR;
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const data = readModuleJson();
  const manifestPath = join(outDir, "module.json");
  const zipPath = join(outDir, "module.zip");

  writeFileSync(manifestPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  const files = collectPackageFiles();
  // Prefer the freshly written build/module.json bytes in the zip.
  const manifestIndex = files.findIndex((file) => file.name === "module.json");
  if (manifestIndex >= 0) {
    files[manifestIndex] = {
      name: "module.json",
      data: readFileSync(manifestPath)
    };
  }

  const zip = buildZipBuffer(files);
  writeFileSync(zipPath, zip);

  // Sanity: zip must start with PK
  if (zip[0] !== 0x50 || zip[1] !== 0x4b) {
    fail("Built module.zip is not a valid ZIP (bad signature).");
  }

  return {
    outDir,
    manifestPath,
    zipPath,
    fileCount: files.length,
    version: data.version,
    bytes: zip.length
  };
}

/**
 * Stream helper kept for future large packages (currently unused).
 * @param {string} zipPath
 * @param {Buffer} buffer
 */
export function writeZipFile(zipPath, buffer) {
  mkdirSync(dirname(zipPath), { recursive: true });
  const stream = createWriteStream(zipPath);
  stream.write(buffer);
  stream.end();
}
