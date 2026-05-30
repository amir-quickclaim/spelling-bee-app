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
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState({ correct: 0, attempted: 0 });
  const [showWord, setShowWord] = useState(false);

  const words = useMemo(() => {
    return wordText
      .split(/\n|,/)
      .map((w) => w.trim())
      .filter(Boolean);
  }, [wordText]);

  const currentWord = words[index] || "";

  function speak() {
    if (!currentWord || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(currentWord);
    utterance.lang = "en-AU";
    utterance.rate = 0.75;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  }

  function checkAnswer() {
    if (!answer.trim()) return;

    const isCorrect = clean(answer) === clean(currentWord);

    setFeedback(isCorrect ? "correct" : "wrong");
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      attempted: prev.attempted + 1
    }));
  }

  function nextWord() {
    setAnswer("");
    setFeedback("");
    setShowWord(false);
    setIndex((prev) => (words.length ? (prev + 1) % words.length : 0));
  }

  function randomWord() {
    if (words.length <= 1) return;

    let next = index;
    while (next === index) {
      next = Math.floor(Math.random() * words.length);
    }

    setAnswer("");
    setFeedback("");
    setShowWord(false);
    setIndex(next);
  }

  function reset() {
    setIndex(0);
    setAnswer("");
    setFeedback("");
    setShowWord(false);
    setScore({ correct: 0, attempted: 0 });
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1>Spelling Bee Practice</h1>
        <p>Listen to the word, type the spelling, then check your answer.</p>

        <div style={styles.grid}>
          <div style={styles.card}>
            <p>
              Word {words.length ? index + 1 : 0} of {words.length}
            </p>

            <h2>Score: {score.correct}/{score.attempted}</h2>

            <button style={styles.primaryButton} onClick={speak}>
              🔊 Play word
            </button>

            <input
              style={styles.input}
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                setFeedback("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") checkAnswer();
              }}
              placeholder="Type spelling here"
              autoFocus
            />

            <div style={styles.buttonRow}>
              <button onClick={checkAnswer}>Check</button>
              <button onClick={nextWord}>Next</button>
              <button onClick={randomWord}>Random</button>
              <button onClick={reset}>Reset</button>
            </div>

            {feedback === "correct" && (
              <h2 style={{ color: "green" }}>Correct!</h2>
            )}

            {feedback === "wrong" && (
              <div>
                <h2 style={{ color: "red" }}>Not quite. Try again.</h2>
                <button onClick={() => setShowWord(true)}>
                  Show correct spelling
                </button>
              </div>
            )}

            {showWord && <h1>{currentWord}</h1>}
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
                setFeedback("");
              }}
            />
          </div>
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
    marginTop: 24
  },
  card: {
    background: "white",
    padding: 24,
    borderRadius: 16,
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)"
  },
  primaryButton: {
    fontSize: 22,
    padding: "16px 30px",
    borderRadius: 12,
    marginBottom: 20
  },
  input: {
    width: "100%",
    fontSize: 28,
    padding: 14,
    textAlign: "center",
    borderRadius: 12,
    border: "1px solid #ccc",
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
  }
};