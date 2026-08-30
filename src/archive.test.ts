import { describe, expect, it } from "vitest";
import { Zip, ZipPassThrough, unzipSync, zip } from "fflate";
import { prepareArchive, readArchive } from "./archive";
import { scanFile } from "./scanner";

function fixture(entries: Array<[string, Uint8Array]>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const archive = new Zip((error, data) => { if (error) throw error; chunks.push(data); });
  for (const [name, bytes] of entries) {
    const file = new ZipPassThrough(name);
    archive.add(file);
    file.push(bytes, true);
  }
  archive.end();
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

describe("archive filename integrity", () => {
  it("rejects an unsupported root __proto__ entry instead of silently losing it", () => {
    const bytes = fixture([["__proto__", new Uint8Array([65, 66])], ["readme.txt", new Uint8Array([67])]]);
    expect(() => readArchive(bytes)).toThrow(/__proto__/);
  });

  it("round-trips ordinary, nested and object-property names", () => {
    const entries: Array<[string, Uint8Array]> = [
      ["readme.txt", new Uint8Array([0, 1, 255])],
      ["project/__proto__", new Uint8Array([65, 66])],
      ["constructor", new Uint8Array([67])], ["toString", new Uint8Array()],
    ];
    const result = readArchive(fixture(entries));
    expect(Object.keys(result)).toEqual(entries.map(([name]) => name));
    for (const [name, bytes] of entries) expect(result[name]).toEqual(bytes);
  });

  it("preserves bytes and avoids collisions when an export path normalizes to __proto__", async () => {
    const inputs = [
      { path: "../__proto__", file: new File([new Uint8Array([65, 66])], "__proto__") },
      { path: "__proto__-file", file: new File([new Uint8Array([67])], "__proto__-file") },
      { path: "constructor", file: new File([new Uint8Array([68])], "constructor") },
    ];
    const scanned = await scanFile(inputs[0].file, inputs[0].path);
    expect(scanned.path).toBe("__proto__-file");
    const prepared = await prepareArchive(inputs);
    const bytes = await new Promise<Uint8Array>((resolve, reject) => zip(prepared, { level: 6 }, (error, result) => error ? reject(error) : resolve(result)));
    const result = unzipSync(bytes);
    expect(Object.keys(result)).toEqual(["__proto__-file", "__proto__-file-2", "constructor"]);
    expect(result["__proto__-file"]).toEqual(new Uint8Array([65, 66]));
    expect(result["__proto__-file-2"]).toEqual(new Uint8Array([67]));
    expect(result.constructor).toEqual(new Uint8Array([68]));
  });

  it("still rejects corrupt ZIP input", () => {
    expect(() => readArchive(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
