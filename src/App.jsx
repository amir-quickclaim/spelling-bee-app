import React, { useMemo, useState } from "react";

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

function clean(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export default function App() {
  const [wordText, setWordText] = useState(defaultWords.join("\n"));
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [started, setStarted] = useState(false);
  const [message, setMessage] = useState("Click Start to begin.");
  const [mistakes, setMistakes] = useState({});
  const [score, setScore] = useState({ correct: 0, attempted: 0 });

  const words = useMemo(() => {
    return wordText
      .split(/\n|,/)
      .map((w) => w.trim())
      .filter(Boolean);
  }, [wordText]);

  const currentWord = words[index] || "";

  function speak(text, rate = 0.72) {
    if (!text || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-AU";
    utterance.rate = rate;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  }

  function readCurrentWord() {
    speak(`Your word is ${currentWord}. Take your time.`, 0.68);
  }

  function spellCurrentWord() {
    const letters = currentWord.split("").join(" ... ");
    speak(`Good try. Let's spell it slowly together. ${letters}. Now have another go.`, 0.48);
  }

  function startPractice() {
    if (!words.length) return;

    setStarted(true);
    setIndex(0);
    setAnswer("");
    setMessage("Listen carefully and type the word.");

    setTimeout(() => {
      speak(`Let's start. Your first word is ${words[0]}. Type it when you're ready.`, 0.68);
    }, 200);
  }

  function checkAnswer() {
    if (!started || !answer.trim() || !currentWord) return;

    const isCorrect = clean(answer) === clean(currentWord);

    if (isCorrect) {
      setScore((prev) => ({
        correct: prev.correct + 1,
        attempted: prev.attempted + 1
      }));

      setMessage("Correct! Great job. Moving to the next word.");
      speak("Correct! Great job. Here comes the next word.", 0.72);

      setTimeout(() => {
        const nextIndex = index + 1;

        if (nextIndex >= words.length) {
          setMessage("Finished! Great work.");
          speak("You finished the practice. Great work today!", 0.72);
          setStarted(false);
          setAnswer("");
          return;
        }

        setIndex(nextIndex);
        setAnswer("");
        setMessage("Listen carefully and type the word.");

        setTimeout(() => {
          speak(`Your next word is ${words[nextIndex]}.`, 0.68);
        }, 300);
      }, 1200);
    } else {
      setScore((prev) => ({
        correct: prev.correct,
        attempted: prev.attempted + 1
      }));

      setMistakes((prev) => ({
        ...prev,
        [currentWord]: (prev[currentWord] || 0) + 1
      }));

      setMessage("Good try. Listen to the spelling slowly, then try again.");
      spellCurrentWord();
      setAnswer("");
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
  }

  function downloadMistakesFile() {
    const rows = [["word", "mistake_count"]];

    Object.entries(mistakes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([word, count]) => rows.push([word, count]));

    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "spelling-bee-mistakes.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1>Spelling Bee Practice</h1>
        <p>Click Start, listen to the word, type the spelling, then press Enter.</p>

        <div style={styles.grid}>
          <div style={styles.card}>
            <p>
              Word {words.length ? index + 1 : 0} of {words.length}
            </p>

            <h2>Score: {score.correct}/{score.attempted}</h2>

            <p style={styles.message}>{message}</p>

            <div style={styles.buttonRow}>
              <button style={styles.primaryButton} onClick={startPractice}>
                Start
              </button>

              <button onClick={readCurrentWord} disabled={!started}>
                Repeat Word
              </button>

              <button onClick={resetPractice}>Reset</button>
            </div>

            <input
              style={styles.input}
              value={answer}
              disabled={!started}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") checkAnswer();
              }}
              placeholder="Type spelling here and press Enter"
              autoFocus
            />

            <button onClick={checkAnswer} disabled={!started}>
              Check
            </button>
          </div>

          <div style={styles.card}>
            <h2>Word List</h2>
            <p>Add one word per line.</p>

            <textarea
              style={styles.textarea}
              value={wordText}
              onChange={(e) => {
                setWordText(e.target.value);
                setIndex(0);
                setAnswer("");
                setStarted(false);
                setMessage("Click Start to begin.");
              }}
            />
          </div>
        </div>

        <div style={styles.card}>
          <h2>Mistake File</h2>
          <p>Words your son spelled incorrectly will be listed here.</p>

          {Object.keys(mistakes).length === 0 ? (
            <p>No mistakes yet.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Number of mistakes</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(mistakes)
                  .sort((a, b) => b[1] - a[1])
                  .map(([word, count]) => (
                    <tr key={word}>
                      <td>{word}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          <button onClick={downloadMistakesFile} disabled={!Object.keys(mistakes).length}>
            Download Mistakes CSV
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
    maxWidth: 1000,
    margin: "0 auto",
    textAlign: "center"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    marginTop: 24,
    marginBottom: 20
  },
  card: {
    background: "white",
    padding: 24,
    borderRadius: 16,
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    marginBottom: 20
  },
  primaryButton: {
    fontSize: 20,
    padding: "12px 28px",
    borderRadius: 12
  },
  input: {
    width: "100%",
    fontSize: 28,
    padding: 14,
    textAlign: "center",
    borderRadius: 12,
    border: "1px solid #ccc",
    marginTop: 20,
    marginBottom: 16
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap"
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
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: 20
  }
};
