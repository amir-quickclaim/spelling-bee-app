import path from "node:path";
import { readJsonStore, writeJsonStore } from "../lib/blobStorage.js";

const mistakesDirectory = path.join(process.cwd(), "data", "mistakes");
const sessionsDirectory = path.join(mistakesDirectory, "sessions");
const masterFilePath = path.join(mistakesDirectory, "master.json");
const masterBlobPath = "mistakes/master.json";

function sessionPaths(sessionId) {
  return {
    filePath: path.join(sessionsDirectory, `${sessionId}.json`),
    blobPath: `mistakes/sessions/${sessionId}.json`
  };
}

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
    if (req.method === "GET") {
      const sessionId = safeSessionId(req.query.sessionId);
      const session = sessionPaths(sessionId);
      const masterData = await readJsonStore(
        masterBlobPath,
        emptyMistakeFile(),
        masterFilePath
      );

      const sessionData = await readJsonStore(
        session.blobPath,
        emptyMistakeFile(),
        session.filePath
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
      const masterData = await readJsonStore(
        masterBlobPath,
        emptyMistakeFile(),
        masterFilePath
      );
      const nextMasterData = recordCorrectMistake(
        masterData,
        word,
        isMistakeSession
      );

      await writeJsonStore(masterBlobPath, nextMasterData, masterFilePath);

      return res.status(200).json({
        sessionMistakes: {},
        allTimeMistakes: nextMasterData.mistakes || {},
        learnedMistakes: nextMasterData.learned || {},
        mistakeProgress: nextMasterData.progress || {}
      });
    }

    const session = sessionPaths(sessionId);
    const sessionData = await readJsonStore(
      session.blobPath,
      {
        startedAt: new Date().toISOString(),
        ...emptyMistakeFile()
      },
      session.filePath
    );
    const masterData = await readJsonStore(
      masterBlobPath,
      emptyMistakeFile(),
      masterFilePath
    );

    const nextSessionData = incrementMistake(sessionData, word);
    const nextMasterData = incrementMistake(masterData, word);

    await writeJsonStore(session.blobPath, nextSessionData, session.filePath);
    await writeJsonStore(masterBlobPath, nextMasterData, masterFilePath);

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
