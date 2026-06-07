import path from "node:path";
import { del, list, put } from "@vercel/blob";
import { readJsonStore, writeJsonStore } from "../lib/blobStorage.js";

const coverageDirectory = path.join(process.cwd(), "data", "coverage");
const coverageFilePath = path.join(coverageDirectory, "master.json");
const coverageBlobPath = "coverage/master.json";
const coverageEventPrefix = "coverage/events/";

function emptyCoverageFile() {
  return {
    updatedAt: new Date().toISOString(),
    words: {}
  };
}

function updateCoverage(fileData, { word, level, result }) {
  const now = new Date().toISOString();
  const currentWordData = fileData.words?.[word] || {
    level,
    asked: 0,
    success: 0,
    error: 0
  };

  const nextWordData = {
    ...currentWordData,
    level: currentWordData.level || level,
    lastAskedAt: now
  };

  if (result === "asked" || result === "success" || result === "error") {
    nextWordData.asked = (nextWordData.asked || 0) + 1;
  }

  if (result === "success") {
    nextWordData.success = (nextWordData.success || 0) + 1;
    nextWordData.lastResult = "success";
  }

  if (result === "error") {
    nextWordData.error = (nextWordData.error || 0) + 1;
    nextWordData.lastResult = "error";
  }

  return {
    ...fileData,
    updatedAt: now,
    words: {
      ...(fileData.words || {}),
      [word]: nextWordData
    }
  };
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function applyCoverageEvent(coverageData, event) {
  return updateCoverage(coverageData, event);
}

async function readCoverageData() {
  const baseCoverage = await readJsonStore(
    coverageBlobPath,
    emptyCoverageFile(),
    coverageFilePath
  );

  if (!hasBlobToken()) {
    return baseCoverage;
  }

  const { blobs } = await list({
    prefix: coverageEventPrefix,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  const sortedBlobs = blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
  const events = await Promise.all(
    sortedBlobs.map(async (blob) => {
        const response = await fetch(blob.downloadUrl || blob.url, {
          cache: "no-store"
        });

        if (!response.ok) return null;

        return response.json();
      }
    )
  );
  const nextCoverage = events
    .filter(Boolean)
    .reduce(
      (coverageData, event) => applyCoverageEvent(coverageData, event),
      baseCoverage
    );

  if (sortedBlobs.length) {
    await writeJsonStore(coverageBlobPath, nextCoverage, coverageFilePath);
    await del(
      sortedBlobs.map((blob) => blob.url),
      { token: process.env.BLOB_READ_WRITE_TOKEN }
    );
  }

  return nextCoverage;
}

async function writeCoverageEvent(event) {
  if (!hasBlobToken()) {
    return;
  }

  const eventPath = `${coverageEventPrefix}${Date.now()}-${crypto.randomUUID()}.json`;

  await put(eventPath, `${JSON.stringify(event, null, 2)}\n`, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const coverageData = await readCoverageData();

      return res.status(200).json({ coverage: coverageData.words || {} });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const word = String(req.body?.word || "").trim();
    const level = String(req.body?.level || "").trim();
    const result = String(req.body?.result || "").trim();

    if (!word || !["asked", "success", "error"].includes(result)) {
      return res.status(400).json({ error: "Missing coverage details" });
    }

    if (hasBlobToken()) {
      await writeCoverageEvent({ word, level, result });
      return res.status(200).json({ ok: true });
    }

    const coverageData = await readCoverageData();
    const nextCoverageData = updateCoverage(coverageData, {
      word,
      level,
      result
    });
    await writeJsonStore(coverageBlobPath, nextCoverageData, coverageFilePath);

    return res.status(200).json({ coverage: nextCoverageData.words });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not save coverage" });
  }
}
