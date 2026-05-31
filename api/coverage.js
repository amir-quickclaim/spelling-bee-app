import fs from "node:fs/promises";
import path from "node:path";

const coverageDirectory = path.join(process.cwd(), "data", "coverage");
const coverageFilePath = path.join(coverageDirectory, "master.json");

function emptyCoverageFile() {
  return {
    updatedAt: new Date().toISOString(),
    words: {}
  };
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
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
      const coverageData = await readJsonFile(
        coverageFilePath,
        emptyCoverageFile()
      );

      await writeJsonFile(coverageFilePath, coverageData);

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

    const coverageData = await readJsonFile(
      coverageFilePath,
      emptyCoverageFile()
    );
    const nextCoverageData = updateCoverage(coverageData, {
      word,
      level,
      result
    });

    await writeJsonFile(coverageFilePath, nextCoverageData);

    return res.status(200).json({ coverage: nextCoverageData.words });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not save coverage" });
  }
}
