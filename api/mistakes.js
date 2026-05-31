import fs from "node:fs/promises";
import path from "node:path";

const mistakesDirectory = path.join(process.cwd(), "data", "mistakes");
const sessionsDirectory = path.join(mistakesDirectory, "sessions");
const masterFilePath = path.join(mistakesDirectory, "master.json");

function emptyMistakeFile() {
  return {
    updatedAt: new Date().toISOString(),
    mistakes: {},
    learned: {},
    progress: {}
  };
}

function safeSessionId(sessionId) {
  return String(sessionId || "session")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 80);
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

function incrementMistake(fileData, word) {
  const nextData = {
    ...fileData,
    updatedAt: new Date().toISOString(),
    mistakes: {
      ...(fileData.mistakes || {})
    },
    learned: {
      ...(fileData.learned || {})
    },
    progress: {
      ...(fileData.progress || {})
    }
  };

  nextData.mistakes[word] = (nextData.mistakes[word] || 0) + 1;
  nextData.progress[word] = {
    consecutiveCorrect: 0,
    updatedAt: nextData.updatedAt
  };

  return nextData;
}

function recordCorrectMistake(fileData, word, isMistakeSession) {
  const now = new Date().toISOString();
  const currentProgress = fileData.progress?.[word] || {};
  const consecutiveCorrect = (currentProgress.consecutiveCorrect || 0) + 1;
  const nextData = {
    ...fileData,
    updatedAt: now,
    mistakes: {
      ...(fileData.mistakes || {})
    },
    learned: {
      ...(fileData.learned || {})
    },
    progress: {
      ...(fileData.progress || {}),
      [word]: {
        consecutiveCorrect,
        updatedAt: now
      }
    }
  };

  if (!isMistakeSession && consecutiveCorrect >= 2 && nextData.mistakes[word]) {
    nextData.learned[word] = {
      mistakeCount: nextData.mistakes[word],
      learnedAt: now
    };
    delete nextData.mistakes[word];
    delete nextData.progress[word];
  }

  return nextData;
}

export default async function handler(req, res) {
  try {
    await fs.mkdir(sessionsDirectory, { recursive: true });

    if (req.method === "GET") {
      const sessionId = safeSessionId(req.query.sessionId);
      const masterData = await readJsonFile(masterFilePath, emptyMistakeFile());
      await writeJsonFile(masterFilePath, masterData);

      const sessionData = await readJsonFile(
        path.join(sessionsDirectory, `${sessionId}.json`),
        emptyMistakeFile()
      );

      return res.status(200).json({
        sessionMistakes: sessionData.mistakes || {},
        allTimeMistakes: masterData.mistakes || {},
        learnedMistakes: masterData.learned || {},
        mistakeProgress: masterData.progress || {}
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const word = String(req.body?.word || "").trim();
    const sessionId = safeSessionId(req.body?.sessionId);
    const result = String(req.body?.result || "error");
    const isMistakeSession = Boolean(req.body?.isMistakeSession);

    if (!word) {
      return res.status(400).json({ error: "Missing word" });
    }

    if (result === "success") {
      const masterData = await readJsonFile(masterFilePath, emptyMistakeFile());
      const nextMasterData = recordCorrectMistake(
        masterData,
        word,
        isMistakeSession
      );

      await writeJsonFile(masterFilePath, nextMasterData);

      return res.status(200).json({
        sessionMistakes: {},
        allTimeMistakes: nextMasterData.mistakes || {},
        learnedMistakes: nextMasterData.learned || {},
        mistakeProgress: nextMasterData.progress || {}
      });
    }

    const sessionFilePath = path.join(sessionsDirectory, `${sessionId}.json`);
    const sessionData = await readJsonFile(sessionFilePath, {
      startedAt: new Date().toISOString(),
      ...emptyMistakeFile()
    });
    const masterData = await readJsonFile(masterFilePath, emptyMistakeFile());

    const nextSessionData = incrementMistake(sessionData, word);
    const nextMasterData = incrementMistake(masterData, word);

    await writeJsonFile(sessionFilePath, nextSessionData);
    await writeJsonFile(masterFilePath, nextMasterData);

    return res.status(200).json({
      sessionMistakes: nextSessionData.mistakes,
      allTimeMistakes: nextMasterData.mistakes,
      learnedMistakes: nextMasterData.learned || {},
      mistakeProgress: nextMasterData.progress || {}
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not save mistake" });
  }
}
