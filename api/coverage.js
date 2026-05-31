import path from "node:path";
import { readJsonStore, writeJsonStore } from "../lib/blobStorage.js";

const coverageDirectory = path.join(process.cwd(), "data", "coverage");
const coverageFilePath = path.join(coverageDirectory, "master.json");
const coverageBlobPath = "coverage/master.json";

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

  if (result === "asked") {
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

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const coverageData = await readJsonStore(
        coverageBlobPath,
        emptyCoverageFile(),
        coverageFilePath
      );

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

    const coverageData = await readJsonStore(
      coverageBlobPath,
      emptyCoverageFile(),
      coverageFilePath
    );
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
