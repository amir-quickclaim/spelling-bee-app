import fs from "node:fs/promises";
import path from "node:path";
import { list, put } from "@vercel/blob";

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJsonStore(blobPath, fallback, localFilePath) {
  if (!hasBlobToken()) {
    return readJsonFile(localFilePath, fallback);
  }

  const { blobs } = await list({
    prefix: blobPath,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  const existingBlob = blobs.find((blob) => blob.pathname === blobPath);

  if (!existingBlob) {
    return fallback;
  }

  const response = await fetch(existingBlob.url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not read ${blobPath} from Vercel Blob`);
  }

  return response.json();
}

export async function writeJsonStore(blobPath, value, localFilePath) {
  if (!hasBlobToken()) {
    await writeJsonFile(localFilePath, value);
    return;
  }

  await put(blobPath, `${JSON.stringify(value, null, 2)}\n`, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
}
