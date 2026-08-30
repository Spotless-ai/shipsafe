import { unzipSync, type AsyncZippable } from "fflate";
import { safeArchivePath } from "./scanner";

export class UnsupportedArchiveNameError extends Error {}

export function readArchive(bytes: Uint8Array) {
  return unzipSync(bytes, { filter: (entry) => {
    // fflate collects extracted files in an ordinary object. Reject this name
    // before extraction so it cannot silently disappear into the prototype.
    if (entry.name === "__proto__") throw new UnsupportedArchiveNameError(
      "This ZIP contains a root-level file named __proto__, which the ZIP reader cannot preserve. Rename that file and recreate the ZIP, or choose its containing folder instead. No files were imported.",
    );
    return !entry.name.endsWith("/");
  } });
}

export async function prepareArchive(
  files: Array<{ path: string; file: File }>,
  onProgress?: (done: number) => void | Promise<void>,
): Promise<AsyncZippable> {
  const archive: AsyncZippable = Object.create(null);
  for (let i = 0; i < files.length; i++) {
    const item = files[i];
    let outputPath = safeArchivePath(item.path);
    let copy = 2;
    while (Object.hasOwn(archive, outputPath)) {
      const dot = outputPath.lastIndexOf(".");
      outputPath = dot > 0
        ? `${outputPath.slice(0, dot)}-${copy}${outputPath.slice(dot)}`
        : `${outputPath}-${copy}`;
      copy++;
    }
    archive[outputPath] = new Uint8Array(await item.file.arrayBuffer());
    await onProgress?.(i + 1);
  }
  return archive;
}
