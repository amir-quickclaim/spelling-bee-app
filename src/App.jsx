import React, { useEffect, useMemo, useRef, useState } from "react";

const sourceLabels = [
  "Level1",
  "Level2",
  "Level3",
  "Level4",
  "Level5",
  "ALL",
  "Mistakes"
];

const levelLabels = ["Level1", "Level2", "Level3", "Level4", "Level5"];

const australianSpellings = {
  apologize: "apologise",
  behavior: "behaviour",
  center: "centre",
  color: "colour",
  favorite: "favourite",
  gray: "grey",
  honor: "honour",
  labor: "labour",
  liter: "litre",
  meter: "metre",
  neighbor: "neighbour",
  organize: "organise",
  realize: "realise",
  theater: "theatre",
  traveled: "travelled",
  traveling: "travelling"
};

function clean(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function toAustralianSpelling(word) {
  const normalisedWord = word.trim();
  const australianWord = australianSpellings[normalisedWord.toLowerCase()];

  return australianWord || normalisedWord;
}

function getBrowserVoices() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();

    if (voices.length) {
      resolve(voices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };

    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
  });
}

function chooseBestVoice(voices) {
  const preferredNames = [
    "Karen",
    "Samantha",
    "Serena",
    "Daniel",
    "Google UK English Female",
    "Microsoft Natasha"
  ];

  return (
    voices.find((voice) => voice.lang === "en-AU" && voice.localService) ||
    voices.find((voice) => voice.lang === "en-AU") ||
    voices.find((voice) => preferredNames.includes(voice.name)) ||
    voices.find((voice) => voice.lang.startsWith("en-") && voice.localService) ||
    voices.find((voice) => voice.lang.startsWith("en-")) ||
    null
  );
}

function compareAnswerToWord(answer, correctWord) {
  const answerCharacters = answer.split("");
  const correctCharacters = correctWord.split("");
  const result = [];
  let answerIndex = 0;
  let correctIndex = 0;

  while (
    answerIndex < answerCharacters.length ||
    correctIndex < correctCharacters.length
  ) {
    const typedCharacter = answerCharacters[answerIndex];
    const correctCharacter = correctCharacters[correctIndex];

    if (typedCharacter === undefined) {
      result.push({ character: "_", isWrong: true });
      correctIndex += 1;
      continue;
    }

    if (correctCharacter === undefined) {
      result.push({ character: typedCharacter, isWrong: true });
      answerIndex += 1;
      continue;
    }

    if (typedCharacter.toLowerCase() === correctCharacter.toLowerCase()) {
      result.push({ character: typedCharacter, isWrong: false });
      answerIndex += 1;
      correctIndex += 1;
      continue;
    }

    const nextCorrectCharacter = correctCharacters[correctIndex + 1];
    const nextTypedCharacter = answerCharacters[answerIndex + 1];

    if (
      nextCorrectCharacter &&
      typedCharacter.toLowerCase() === nextCorrectCharacter.toLowerCase()
    ) {
      result.push({ character: "_", isWrong: true });
      correctIndex += 1;
      continue;
    }

    if (
      nextTypedCharacter &&
      nextTypedCharacter.toLowerCase() === correctCharacter.toLowerCase()
    ) {
      result.push({ character: typedCharacter, isWrong: true });
      answerIndex += 1;
      continue;
    }

    result.push({ character: typedCharacter, isWrong: true });
    answerIndex += 1;
    correctIndex += 1;
  }

  return result;
}

function createSessionId() {
  return `liam-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

function shuffleWords(words) {
  const shuffledWords = [...words];

  for (let index = shuffledWords.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledWords[index], shuffledWords[randomIndex]] = [
      shuffledWords[randomIndex],
      shuffledWords[index]
    ];
  }

  return shuffledWords;
}

function buildPracticeWords(selectedWords, mistakeWords, isMistakeSession) {
  const shuffledMistakes = shuffleWords(mistakeWords);

  if (isMistakeSession) {
    return shuffledMistakes;
  }

  const mistakeSet = new Set(mistakeWords);
  const shuffledWords = shuffleWords(
    selectedWords.filter((word) => !mistakeSet.has(word))
  );

  if (!shuffledMistakes.length) {
    return shuffledWords;
  }

  const scheduledWords = [];
  let mistakeIndex = 0;

  shuffledWords.forEach((word, index) => {
    if ((index + 1) % 15 === 0) {
      scheduledWords.push(shuffledMistakes[mistakeIndex % shuffledMistakes.length]);
      mistakeIndex += 1;
    }

    scheduledWords.push(word);
  });

  return scheduledWords;
}

export default function App() {
  const answerInputRef = useRef(null);
  const [wordsByLevel, setWordsByLevel] = useState({});
  const [meaningsByWord, setMeaningsByWord] = useState({});
  const [examplesByWord, setExamplesByWord] = useState({});
  const [selectedSources, setSelectedSources] = useState(["ALL", "Mistakes"]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [started, setStarted] = useState(false);
  const [message, setMessage] = useState("Click Start to begin.");
  const [mistakes, setMistakes] = useState({});
  const [score, setScore] = useState({ correct: 0, attempted: 0 });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [attemptFeedback, setAttemptFeedback] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [allTimeMistakes, setAllTimeMistakes] = useState({});
  const [learnedMistakes, setLearnedMistakes] = useState({});
  const [mistakeProgress, setMistakeProgress] = useState({});
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [needsCorrectSpelling, setNeedsCorrectSpelling] = useState(false);
  const [practiceWords, setPracticeWords] = useState([]);
  const [coverage, setCoverage] = useState({});

  const words = useMemo(() => {
    const selectedWords = [];

    if (selectedSources.includes("ALL")) {
      levelLabels.forEach((level) => {
        selectedWords.push(...(wordsByLevel[level] || []));
      });
    }

    levelLabels.forEach((level) => {
      if (selectedSources.includes(level)) {
        selectedWords.push(...(wordsByLevel[level] || []));
      }
    });

    if (selectedSources.includes("Mistakes")) {
      selectedWords.push(...Object.keys(allTimeMistakes));
    }

    return [...new Set(selectedWords.map(toAustralianSpelling).filter(Boolean))];
  }, [allTimeMistakes, selectedSources, wordsByLevel]);

  const wordLevels = useMemo(() => {
    const levels = {};

    levelLabels.forEach((level) => {
      (wordsByLevel[level] || []).forEach((word) => {
        levels[toAustralianSpelling(word)] = level;
      });
    });

    return levels;
  }, [wordsByLevel]);

  const currentWord = practiceWords[index] || "";
  const isMistakeSession =
    selectedSources.length === 1 && selectedSources.includes("Mistakes");

  function focusAnswerInput() {
    requestAnimationFrame(() => {
      answerInputRef.current?.focus();
    });
  }

  useEffect(() => {
    if (started) {
      focusAnswerInput();
    }
  }, [started, isSpeaking, index]);

  useEffect(() => {
    loadWords();
    loadMistakes();
    loadCoverage();
  }, []);

  function wait(milliseconds) {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  function spokenCharacter(character) {
    if (character === " ") return "space";
    if (character === "-") return "hyphen";
    if (character === "'") return "apostrophe";

    return character.toLowerCase();
  }

  async function speakWithBrowserVoice(text, options = {}) {
    if (!text || !window.speechSynthesis) {
      return Promise.reject(new Error("Browser speech is not available."));
    }

    const voices = await getBrowserVoices();
    const voice = chooseBestVoice(voices);

    return new Promise((resolve, reject) => {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-AU";
      utterance.voice = voice;
      utterance.rate = options.rate ?? 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onend = resolve;
      utterance.onerror = () => reject(new Error("Browser speech failed."));

      window.speechSynthesis.speak(utterance);
    });
  }

  async function speak(text) {
    try {
      setIsSpeaking(true);
      await speakWithBrowserVoice(text);
    } catch (error) {
      console.error(error);
      alert(`Voice failed. ${error.message}`);
    } finally {
      setIsSpeaking(false);
    }
  }

  async function speakWrongSpelling(word) {
    try {
      setIsSpeaking(true);
      await speakWithBrowserVoice("Wrong, the correct spelling is", {
        rate: 0.9
      });

      for (const character of word) {
        await wait(180);
        await speakWithBrowserVoice(spokenCharacter(character), {
          rate: 0.5
        });
      }

      await wait(250);
      await speakWithBrowserVoice(
        "Now type correct spelling.",
        {
          rate: 0.9
        }
      );
    } catch (error) {
      console.error(error);
      alert(`Voice failed. ${error.message}`);
    } finally {
      setIsSpeaking(false);
      focusAnswerInput();
    }
  }

  async function speakRetryPrompt() {
    try {
      setIsSpeaking(true);
      await speakWithBrowserVoice("Wrong try again", {
        rate: 0.9
      });
    } catch (error) {
      console.error(error);
      alert(`Voice failed. ${error.message}`);
    } finally {
      setIsSpeaking(false);
      focusAnswerInput();
    }
  }

  function resetPracticeProgress() {
    window.speechSynthesis?.cancel();
    setIndex(0);
    setPracticeWords([]);
    setAnswer("");
    setStarted(false);
    setMessage("Click Start to begin.");
    setMistakes({});
    setScore({ correct: 0, attempted: 0 });
    setAttemptFeedback(null);
    setSessionId("");
    setWrongAttempts(0);
    setNeedsCorrectSpelling(false);
  }

  function toggleSource(source) {
    setSelectedSources((prev) => {
      if (prev.includes(source)) {
        return prev.filter((item) => item !== source);
      }

      if (levelLabels.includes(source)) {
        return [...prev.filter((item) => item !== "ALL"), source];
      }

      return [...prev, source];
    });
    resetPracticeProgress();
  }

  async function loadWords() {
    try {
      const response = await fetch("/api/words");

      if (!response.ok) {
        throw new Error("Could not load word list");
      }

      const data = await response.json();
      setWordsByLevel(data.wordsByLevel || {});
      setMeaningsByWord(data.meaningsByWord || {});
      setExamplesByWord(data.examplesByWord || {});
    } catch (error) {
      console.error(error);
      setMessage("Could not load the spelling bee word list.");
    }
  }

  async function loadCoverage() {
    try {
      const response = await fetch("/api/coverage");

      if (!response.ok) return;

      const data = await response.json();
      setCoverage(data.coverage || {});
    } catch (error) {
      console.error("Could not load coverage", error);
    }
  }

  async function saveCoverage(word, result) {
    try {
      const response = await fetch("/api/coverage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          word,
          level: wordLevels[word] || "Mistakes",
          result
        })
      });

      if (!response.ok) {
        throw new Error("Could not save coverage");
      }

      const data = await response.json();
      setCoverage(data.coverage || {});
    } catch (error) {
      console.error(error);
    }
  }

  async function loadMistakes(activeSessionId = "") {
    try {
      const query = activeSessionId
        ? `?sessionId=${encodeURIComponent(activeSessionId)}`
        : "";
      const response = await fetch(`/api/mistakes${query}`);

      if (!response.ok) return;

      const data = await response.json();

      if (activeSessionId) {
        setMistakes(data.sessionMistakes || {});
      }

      setAllTimeMistakes(data.allTimeMistakes || {});
      setLearnedMistakes(data.learnedMistakes || {});
      setMistakeProgress(data.mistakeProgress || {});
    } catch (error) {
      console.error("Could not load mistakes", error);
    }
  }

  function updateMistakeState(data, nextSessionMistakes = mistakes) {
    setMistakes(data.sessionMistakes || nextSessionMistakes);
    setAllTimeMistakes(data.allTimeMistakes || {});
    setLearnedMistakes(data.learnedMistakes || {});
    setMistakeProgress(data.mistakeProgress || {});
  }

  async function saveMistake(word, activeSessionId, nextSessionMistakes) {
    try {
      const response = await fetch("/api/mistakes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: activeSessionId,
          word,
          result: "error"
        })
      });

      if (!response.ok) {
        throw new Error("Could not save mistake");
      }

      const data = await response.json();
      updateMistakeState(data, nextSessionMistakes);
    } catch (error) {
      console.error(error);
      setMistakes(nextSessionMistakes);
      setAllTimeMistakes((prev) => ({
        ...prev,
        [word]: (prev[word] || 0) + 1
      }));
    }
  }

  async function saveMistakeSuccess(word) {
    try {
      const response = await fetch("/api/mistakes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          word,
          result: "success",
          isMistakeSession
        })
      });

      if (!response.ok) {
        throw new Error("Could not update mistake progress");
      }

      const data = await response.json();
      setAllTimeMistakes(data.allTimeMistakes || {});
      setLearnedMistakes(data.learnedMistakes || {});
      setMistakeProgress(data.mistakeProgress || {});
    } catch (error) {
      console.error(error);
    }
  }

  async function startPractice() {
    if (!words.length) {
      setMessage("Choose at least one word source before starting.");
      return;
    }

    const nextSessionId = createSessionId();

    const mistakeWords = Object.keys(allTimeMistakes).map(toAustralianSpelling);
    const nextPracticeWords = buildPracticeWords(
      words,
      mistakeWords,
      isMistakeSession
    );

    setSessionId(nextSessionId);
    setPracticeWords(nextPracticeWords);
    setStarted(true);
    setIndex(0);
    setAnswer("");
    setMistakes({});
    setAttemptFeedback(null);
    setWrongAttempts(0);
    setNeedsCorrectSpelling(false);
    setMessage("Listen carefully and type the word.");
    await saveCoverage(nextPracticeWords[0], "asked");

    await speak(
      `Hello Liam, let's practise together and become the school champion. Your first word is ${nextPracticeWords[0]}.`
    );
  }

  async function repeatWord() {
    if (!started || !currentWord) return;

    await speak("Your word is");
    await wait(500);
    await speakWithBrowserVoice(currentWord, { rate: 0.75 });
  }

  async function readDefinition() {
    if (!started || !currentWord) return;

    const definition = meaningsByWord[currentWord];

    if (!definition) {
      await speak("I do not have a definition for this word.");
      return;
    }

    await speak(`Definition. ${definition}`);
  }

  async function readExample() {
    if (!started || !currentWord) return;

    const example = examplesByWord[currentWord];

    if (!example) {
      await speak("I do not have an example for this word.");
      return;
    }

    await speak(`Example. ${example}`);
  }

  async function checkAnswer() {
    if (!started || !answer.trim() || !currentWord) return;

    const submittedAnswer = answer.trim();
    const isCorrect = clean(submittedAnswer) === clean(currentWord);

    if (isCorrect) {
      if (!needsCorrectSpelling) {
        await saveCoverage(currentWord, "success");

        if (allTimeMistakes[currentWord]) {
          await saveMistakeSuccess(currentWord);
        }
      }

      setAttemptFeedback({
        status: "correct",
        answer: submittedAnswer,
        correctWord: currentWord,
        showClues: needsCorrectSpelling
      });
      setWrongAttempts(0);
      setNeedsCorrectSpelling(false);
      setScore((prev) => ({
        correct: prev.correct + 1,
        attempted: prev.attempted + 1
      }));

      setMessage("Correct! Great job.");

      const nextIndex = index + 1;

      if (nextIndex >= practiceWords.length) {
        setStarted(false);
        setAnswer("");
        await speak("Correct. You finished the practice. Great work today.");
        setMessage("Finished! Great work.");
        return;
      }

      setIndex(nextIndex);
      setAnswer("");
      setWrongAttempts(0);
      setNeedsCorrectSpelling(false);
      setMessage("Listen carefully and type the word.");

      await saveCoverage(practiceWords[nextIndex], "asked");
      await speak("Correct, the next word is");
      await wait(500);
      await speak(practiceWords[nextIndex]);
    } else {
      const nextWrongAttempts = wrongAttempts + 1;

      if (!needsCorrectSpelling && wrongAttempts === 0) {
        await saveCoverage(currentWord, "error");
      }

      setScore((prev) => ({
        correct: prev.correct,
        attempted: prev.attempted + 1
      }));
      setWrongAttempts(nextWrongAttempts);

      const activeSessionId = sessionId || createSessionId();
      const nextSessionMistakes = {
        ...mistakes,
        [currentWord]: (mistakes[currentWord] || 0) + 1
      };

      if (!sessionId) {
        setSessionId(activeSessionId);
      }

      setMistakes((prev) => ({
        ...prev,
        [currentWord]: (prev[currentWord] || 0) + 1
      }));
      await saveMistake(currentWord, activeSessionId, nextSessionMistakes);

      setAnswer("");

      if (!needsCorrectSpelling && nextWrongAttempts <= 1) {
        setAttemptFeedback(null);
        setMessage("Wrong. Try again.");
        await speakRetryPrompt();
        return;
      }

      setNeedsCorrectSpelling(true);
      setAttemptFeedback({
        status: "wrong",
        answer: submittedAnswer,
        correctWord: currentWord
      });
      setMessage("Type the correct spelling to move to the next word.");

      await speakWrongSpelling(currentWord);
      setAttemptFeedback((prev) =>
        prev?.status === "wrong" ? { ...prev, showCorrectSpelling: false } : prev
      );
    }
  }

  function resetPractice() {
    resetPracticeProgress();
  }

  function downloadMistakesFile(mistakeList, filename) {
    const rows = [["word", "mistake_count"]];

    Object.entries(mistakeList)
      .sort((a, b) => b[1] - a[1])
      .forEach(([word, count]) => rows.push([word, count]));

    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  function renderMistakeList(mistakeList, emptyText) {
    if (Object.keys(mistakeList).length === 0) {
      return <p>{emptyText}</p>;
    }

    return (
      <table style={styles.table}>
        <tbody>
          {Object.entries(mistakeList)
            .sort((a, b) => b[1] - a[1])
            .map(([word, count]) => (
              <tr key={word}>
                <td>{word}</td>
                <td>{count}</td>
              </tr>
            ))}
        </tbody>
      </table>
    );
  }

  function renderLearnedList() {
    if (Object.keys(learnedMistakes).length === 0) {
      return <p>No learned mistakes yet.</p>;
    }

    return (
      <table style={styles.table}>
        <tbody>
          {Object.entries(learnedMistakes)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([word, details]) => (
              <tr key={word}>
                <td>{word}</td>
                <td>{details.mistakeCount || 0}</td>
              </tr>
            ))}
        </tbody>
      </table>
    );
  }

  function renderAttemptFeedback() {
    if (!attemptFeedback) return null;

    const meaning = meaningsByWord[attemptFeedback.correctWord];
    const example = examplesByWord[attemptFeedback.correctWord];
    const shouldShowClues =
      attemptFeedback.status === "wrong" || attemptFeedback.showClues;

    if (attemptFeedback.status === "correct") {
      return (
        <div style={styles.feedbackArea}>
          <div style={styles.correctAnswer}>{attemptFeedback.answer}</div>
          {shouldShowClues && (
            <div style={styles.cluePanel}>
              {meaning && <div><strong>Definition:</strong> {meaning}</div>}
              {example && <div><strong>Example:</strong> {example}</div>}
            </div>
          )}
        </div>
      );
    }

    const comparedAnswer = compareAnswerToWord(
      attemptFeedback.answer,
      attemptFeedback.correctWord
    );

    return (
      <div style={styles.feedbackArea}>
        <div style={styles.feedbackContent}>
          <div style={styles.spellingFeedback}>
            <div style={styles.wrongAnswer}>
              {comparedAnswer.map(({ character, isWrong }, position) => (
                <span
                  key={`${position}-${character}`}
                  style={isWrong ? styles.wrongCharacter : styles.answerCharacter}
                >
                  {character}
                </span>
              ))}
            </div>

            {attemptFeedback.showCorrectSpelling !== false && (
              <div style={styles.correctSpelling}>
                {attemptFeedback.correctWord}
              </div>
            )}
          </div>

          {shouldShowClues && (
            <div style={styles.cluePanel}>
              {meaning && <div><strong>Definition:</strong> {meaning}</div>}
              {example && <div><strong>Example:</strong> {example}</div>}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderCoverage() {
    return (
      <div style={styles.card}>
        <h2>Coverage</h2>

        <div style={styles.coverageGrid}>
          {levelLabels.map((level) => {
            const levelWords = (wordsByLevel[level] || []).map(toAustralianSpelling);
            const totalWords = levelWords.length;
            const askedWords = levelWords.filter(
              (word) => (coverage[word]?.asked || 0) > 0
            ).length;
            const successWords = levelWords.filter(
              (word) => (coverage[word]?.success || 0) > 0
            ).length;
            const errorWords = levelWords.filter(
              (word) => (coverage[word]?.error || 0) > 0
            ).length;
            const coveragePercent = totalWords
              ? Math.round((askedWords / totalWords) * 100)
              : 0;

            return (
              <div key={level} style={styles.coverageItem}>
                <strong>{level}</strong>
                <div style={styles.coveragePercent}>{coveragePercent}%</div>
                <div>
                  Asked {askedWords}/{totalWords}
                </div>
                <div>Correct {successWords}</div>
                <div>Errors {errorWords}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1>Spelling Bee Practice</h1>

        <div style={styles.sourceBar}>
          {sourceLabels.map((source) => {
            const isSelected = selectedSources.includes(source);

            return (
              <button
                key={source}
                type="button"
                style={{
                  ...styles.sourceButton,
                  ...(isSelected ? styles.selectedSourceButton : {})
                }}
                onClick={() => toggleSource(source)}
              >
                {source}
              </button>
            );
          })}
        </div>

        <div style={styles.mainCard}>
            {isMistakeSession && (
              <h2 style={styles.practiceTitle}>Mistake Session</h2>
            )}

            <div style={styles.buttonRow}>
              <button style={styles.primaryButton} onClick={startPractice}>
                Start
              </button>

              <button onClick={repeatWord} disabled={!started || isSpeaking}>
                Repeat Word
              </button>

              <button onClick={readDefinition} disabled={!started || isSpeaking}>
                Definition
              </button>

              <button onClick={readExample} disabled={!started || isSpeaking}>
                Example
              </button>

              <button onClick={resetPractice}>Reset</button>
            </div>

            <input
              ref={answerInputRef}
              style={styles.input}
              value={answer}
              disabled={!started}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSpeaking) checkAnswer();
              }}
              placeholder="Type spelling here and press Enter"
              autoFocus
            />

            {renderAttemptFeedback()}

            <div style={styles.smallScore}>
              Score {score.correct}/{score.attempted}
            </div>
          </div>

        {renderCoverage()}

        <div style={styles.card}>
          <h2>Session Mistakes</h2>

          {renderMistakeList(mistakes, "No session mistakes yet.")}

          <button
            onClick={() =>
              downloadMistakesFile(mistakes, "spelling-bee-session-mistakes.csv")
            }
            disabled={!Object.keys(mistakes).length}
          >
            Download Session CSV
          </button>

          <h2 style={styles.allTimeHeading}>All Time Mistakes</h2>

          {renderMistakeList(allTimeMistakes, "No all-time mistakes yet.")}

          <button
            onClick={() =>
              downloadMistakesFile(
                allTimeMistakes,
                "spelling-bee-all-time-mistakes.csv"
              )
            }
            disabled={!Object.keys(allTimeMistakes).length}
          >
            Download All Time CSV
          </button>

          <h2 style={styles.allTimeHeading}>Learned Mistakes</h2>

          {renderLearnedList()}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: 24,
    fontFamily: "Arial, sans-serif"
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    textAlign: "center"
  },
  card: {
    background: "white",
    padding: 24,
    borderRadius: 16,
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    marginBottom: 20
  },
  sourceBar: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: 20
  },
  sourceButton: {
    border: "2px solid #b8c2d6",
    background: "white",
    color: "#344054",
    borderRadius: 999,
    padding: "10px 18px",
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer"
  },
  selectedSourceButton: {
    borderColor: "#3f7cff",
    background: "#3f7cff",
    color: "white"
  },
  mainCard: {
    position: "relative",
    background: "white",
    minHeight: 470,
    padding: "44px 44px 64px",
    borderRadius: 24,
    boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
    marginBottom: 20,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center"
  },
  practiceTitle: {
    marginTop: 0,
    marginBottom: 18,
    color: "#344054"
  },
  primaryButton: {
    fontSize: 20,
    padding: "12px 28px",
    borderRadius: 12
  },
  input: {
    width: "100%",
    maxWidth: 760,
    fontSize: 46,
    padding: "24px 18px",
    textAlign: "center",
    borderRadius: 18,
    border: "2px solid #b8c2d6",
    marginTop: 28,
    marginBottom: 18,
    outlineColor: "#3f7cff"
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap"
  },
  smallScore: {
    position: "absolute",
    right: 24,
    bottom: 18,
    color: "#667085",
    fontSize: 14,
    fontWeight: "bold"
  },
  feedbackArea: {
    minHeight: 92,
    marginBottom: 16
  },
  feedbackContent: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) minmax(320px, 1.2fr)",
    gap: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 980
  },
  spellingFeedback: {
    textAlign: "center"
  },
  correctAnswer: {
    color: "#16833a",
    fontSize: 40,
    fontWeight: "bold",
    letterSpacing: 1
  },
  wrongAnswer: {
    fontSize: 40,
    fontWeight: "bold",
    letterSpacing: 1,
    minHeight: 50
  },
  answerCharacter: {
    color: "#1f2937"
  },
  wrongCharacter: {
    color: "#d92d20"
  },
  correctSpelling: {
    color: "#16833a",
    fontSize: 40,
    fontWeight: "bold",
    letterSpacing: 1
  },
  cluePanel: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "normal",
    lineHeight: 1.45,
    textAlign: "left"
  },
  message: {
    fontSize: 20,
    fontWeight: "bold"
  },
  allTimeHeading: {
    marginTop: 28
  },
  coverageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12
  },
  coverageItem: {
    background: "#f8fafc",
    border: "1px solid #e4e7ec",
    borderRadius: 12,
    padding: 14
  },
  coveragePercent: {
    color: "#3f7cff",
    fontSize: 28,
    fontWeight: "bold",
    margin: "8px 0"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: 20
  }
};
