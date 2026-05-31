import React, { useEffect, useMemo, useRef, useState } from "react";

const defaultWords = [
  "accommodation",
  "beautiful",
  "because",
  "calendar",
  "definitely",
  "environment",
  "favourite",
  "February",
  "government",
  "knowledge",
  "necessary",
  "separate",
  "successful",
  "tomorrow",
  "weird"
];

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

function normaliseAustralianWordList(value) {
  return value
    .split(/(\n|,)/)
    .map((part) => {
      if (part === "\n" || part === ",") return part;

      return toAustralianSpelling(part);
    })
    .join("");
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

export default function App() {
  const answerInputRef = useRef(null);
  const [wordText, setWordText] = useState(defaultWords.join("\n"));
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [started, setStarted] = useState(false);
  const [message, setMessage] = useState("Click Start to begin.");
  const [mistakes, setMistakes] = useState({});
  const [score, setScore] = useState({ correct: 0, attempted: 0 });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [attemptFeedback, setAttemptFeedback] = useState(null);
  const [isWordListOpen, setIsWordListOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [allTimeMistakes, setAllTimeMistakes] = useState({});
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [needsCorrectSpelling, setNeedsCorrectSpelling] = useState(false);

  const words = useMemo(() => {
    return wordText
      .split(/\n|,/)
      .map((w) => w.trim())
      .map(toAustralianSpelling)
      .filter(Boolean);
  }, [wordText]);

  const currentWord = words[index] || "";

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
    loadMistakes();
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
        "Now type the correct spelling before we move to the next word.",
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
    } catch (error) {
      console.error("Could not load mistakes", error);
    }
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
          word
        })
      });

      if (!response.ok) {
        throw new Error("Could not save mistake");
      }

      const data = await response.json();
      setMistakes(data.sessionMistakes || nextSessionMistakes);
      setAllTimeMistakes(data.allTimeMistakes || {});
    } catch (error) {
      console.error(error);
      setMistakes(nextSessionMistakes);
      setAllTimeMistakes((prev) => ({
        ...prev,
        [word]: (prev[word] || 0) + 1
      }));
    }
  }

  async function startPractice() {
    if (!words.length) return;

    const nextSessionId = createSessionId();

    setSessionId(nextSessionId);
    setStarted(true);
    setIndex(0);
    setAnswer("");
    setMistakes({});
    setAttemptFeedback(null);
    setWrongAttempts(0);
    setNeedsCorrectSpelling(false);
    setMessage("Listen carefully and type the word.");

    await speak(
      `Hello Liam, let's practise together and become the school champion. Your first word is ${words[0]}.`
    );
  }

  async function repeatWord() {
    if (!started || !currentWord) return;

    await speak(`Your word is ${currentWord}. Take your time.`);
  }

  async function checkAnswer() {
    if (!started || !answer.trim() || !currentWord) return;

    const submittedAnswer = answer.trim();
    const isCorrect = clean(submittedAnswer) === clean(currentWord);

    if (isCorrect) {
      setAttemptFeedback({
        status: "correct",
        answer: submittedAnswer,
        correctWord: currentWord
      });
      setWrongAttempts(0);
      setNeedsCorrectSpelling(false);
      setScore((prev) => ({
        correct: prev.correct + 1,
        attempted: prev.attempted + 1
      }));

      setMessage("Correct! Great job.");

      const nextIndex = index + 1;

      if (nextIndex >= words.length) {
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

      await speak(`Correct, the next word is ${words[nextIndex]}.`);
    } else {
      const nextWrongAttempts = wrongAttempts + 1;

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
    window.speechSynthesis?.cancel();
    setIndex(0);
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

  function renderAttemptFeedback() {
    if (!attemptFeedback) return null;

    if (attemptFeedback.status === "correct") {
      return (
        <div style={styles.feedbackArea}>
          <div style={styles.correctAnswer}>{attemptFeedback.answer}</div>
        </div>
      );
    }

    const comparedAnswer = compareAnswerToWord(
      attemptFeedback.answer,
      attemptFeedback.correctWord
    );

    return (
      <div style={styles.feedbackArea}>
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
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1>Spelling Bee Practice</h1>

        <div style={styles.mainCard}>
            <div style={styles.buttonRow}>
              <button style={styles.primaryButton} onClick={startPractice}>
                Start
              </button>

              <button onClick={repeatWord} disabled={!started || isSpeaking}>
                Repeat Word
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

        <details
          style={styles.card}
          open={isWordListOpen}
          onToggle={(event) => setIsWordListOpen(event.currentTarget.open)}
        >
          <summary style={styles.summary}>Word List</summary>

          <textarea
            style={styles.textarea}
            value={wordText}
            onChange={(e) => {
              setWordText(normaliseAustralianWordList(e.target.value));
              setIndex(0);
              setAnswer("");
              setAttemptFeedback(null);
              setWrongAttempts(0);
              setNeedsCorrectSpelling(false);
              setStarted(false);
              setMessage("Click Start to begin.");
            }}
          />
        </details>

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
    letterSpacing: 1,
    marginTop: 8
  },
  summary: {
    cursor: "pointer",
    fontSize: 22,
    fontWeight: "bold"
  },
  textarea: {
    width: "100%",
    minHeight: 360,
    fontSize: 16,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #ccc"
  },
  message: {
    fontSize: 20,
    fontWeight: "bold"
  },
  allTimeHeading: {
    marginTop: 28
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: 20
  }
};
