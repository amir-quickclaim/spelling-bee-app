import fs from "node:fs/promises";
import path from "node:path";
import { head, put } from "@vercel/blob";

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function isBlobNotFound(error) {
  return (
    error.name === "BlobNotFoundError" ||
    error.constructor?.name === "BlobNotFoundError" ||
    error.message?.includes("BlobNotFoundError") ||
    error.message?.includes("not found")
  );
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

  let existingBlob;

  try {
    existingBlob = await head(blobPath, {
    token: process.env.BLOB_READ_WRITE_TOKEN
    });
  } catch (error) {
    if (!isBlobNotFound(error)) {
      throw error;
    }
  }

  if (!existingBlob) {
    return fallback;
  }

  const response = await fetch(existingBlob.downloadUrl || existingBlob.url, {
    cache: "no-store"
  });

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
    cacheControlMaxAge: 0,
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
}
