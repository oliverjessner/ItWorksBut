import fs from "node:fs/promises";
import path from "node:path";

export const MAX_TEXT_FILE_BYTES = 1024 * 1024;

export async function fileExists(absolutePath) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export async function readFileSafe(absolutePath, maxBytes = MAX_TEXT_FILE_BYTES) {
  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    return await fs.readFile(absolutePath, "utf8");
  } catch {
    return null;
  }
}

export async function readJsonSafe(absolutePath) {
  const content = await readFileSafe(absolutePath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function resolveInside(rootPath, relativePath) {
  return path.resolve(rootPath, relativePath);
}

export async function isLikelyTextFile(absolutePath, maxBytes = MAX_TEXT_FILE_BYTES) {
  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile() || stat.size > maxBytes) return false;

    const handle = await fs.open(absolutePath, "r");
    try {
      const length = Math.min(8192, stat.size);
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, 0);
      if (buffer.includes(0)) return false;
      return true;
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}
