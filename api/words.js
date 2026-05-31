import fs from "node:fs/promises";
import path from "node:path";

const wordListPath = path.join(process.cwd(), "data", "spelling_bee_wordlist.csv");
const levelNames = ["Level1", "Level2", "Level3", "Level4", "Level5"];

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let isInsideQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      isInsideQuote = !isInsideQuote;
      continue;
    }

    if (character === "," && !isInsideQuote) {
      values.push(value);
      value = "";
      continue;
    }

    value += character;
  }

  values.push(value);

  return values;
}

function normaliseLevel(value) {
  return value.replace(/\s+/g, "");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const csv = await fs.readFile(wordListPath, "utf8");
    const rows = csv.split(/\r?\n/).filter(Boolean);
    const wordsByLevel = Object.fromEntries(levelNames.map((level) => [level, []]));
    const meaningsByWord = {};

    rows.slice(1).forEach((row) => {
      const [level, word, , meaning] = parseCsvLine(row);
      const levelKey = normaliseLevel(level || "");
      const spellingWord = String(word || "").trim();
      const spellingMeaning = String(meaning || "").trim();

      if (wordsByLevel[levelKey] && spellingWord) {
        wordsByLevel[levelKey].push(spellingWord);
        meaningsByWord[spellingWord] = spellingMeaning;
      }
    });

    return res.status(200).json({ wordsByLevel, meaningsByWord });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load word list" });
  }
}
