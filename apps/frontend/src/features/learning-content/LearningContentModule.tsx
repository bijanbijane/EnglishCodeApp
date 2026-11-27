import { useMemo, useState } from "react";
import wordsData from "./data/vocabulary.json";
import mistakesData from "./data/common-mistakes.json";
import "./learning-content.css";

type WordEntry = { word: string; sense: string; pos: string; definition: string; level: 1 | 2 | 3; synonyms: string[]; related: string[] };
type MistakeEntry = { id: string; category: string; cefr: string; learner_sentence: string; corrected_sentence: string; explanation: string; practice_prompt: string; tags: string[] };
type Tab = "vocabulary" | "correction";
const words = wordsData as WordEntry[];
const mistakes = mistakesData as MistakeEntry[];
const levelName = (level: number) => level === 1 ? "Beginner" : level === 2 ? "Intermediate" : "Advanced";

export default function LearningContentModule({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("vocabulary");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [wordIndex, setWordIndex] = useState(0);
  const [mistakeIndex, setMistakeIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const filteredWords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((entry) => (level === "all" || String(entry.level) === level)
      && (!q || [entry.word, entry.sense, entry.definition, ...entry.synonyms].join(" ").toLowerCase().includes(q)));
  }, [query, level]);
  const currentWord = filteredWords[Math.min(wordIndex, Math.max(0, filteredWords.length - 1))];
  const currentMistake = mistakes[mistakeIndex % mistakes.length];
  const speak = (value: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  };

  return <section className="learning-library" aria-labelledby="library-title">
    <div className="library-topline">
      <button className="text-button" onClick={onBack}>← Back to learning</button>
      <span className="library-kicker">OPEN LEARNING MODULE · V1</span>
    </div>
    <div className="library-heading">
      <div><p className="eyebrow">BUILD YOUR ENGLISH, ONE IDEA AT A TIME</p><h2 id="library-title">Learning library<span>.</span></h2>
        <p>Explore meaning, build vocabulary, and notice the patterns behind common mistakes.</p></div>
      <div className="library-count"><strong>2,178</strong><span>learning records</span></div>
    </div>
    <div className="library-tabs" role="tablist" aria-label="Learning tools">
      <button role="tab" aria-selected={tab === "vocabulary"} className={tab === "vocabulary" ? "active" : ""} onClick={() => setTab("vocabulary")}><span>01</span> Vocabulary</button>
      <button role="tab" aria-selected={tab === "correction"} className={tab === "correction" ? "active" : ""} onClick={() => { setTab("correction"); setRevealed(false); }}><span>02</span> Error clinic</button>
    </div>
    {tab === "vocabulary" ? <div className="library-workspace">
      <div className="library-tools">
        <label className="library-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setWordIndex(0); }} placeholder="Search a word, meaning, or synonym" aria-label="Search vocabulary" /></label>
        <label className="level-filter"><span>LEVEL</span><select value={level} onChange={(event) => { setLevel(event.target.value); setWordIndex(0); }}><option value="all">All levels</option><option value="1">Beginner</option><option value="2">Intermediate</option><option value="3">Advanced</option></select></label>
      </div>
      {currentWord ? <article className="word-card">
        <div className="word-card-meta"><span>WORD IN CONTEXT</span><span className={`word-level level-${currentWord.level}`}>{levelName(currentWord.level)}</span></div>
        <div className="word-title-row"><div><h3>{currentWord.word}</h3><p>{currentWord.sense} · {currentWord.pos.toUpperCase()}</p></div><button className="sound-button" onClick={() => speak(currentWord.word)} aria-label={`Pronounce ${currentWord.word}`}>♫</button></div>
        <div className="word-definition"><span>MEANING</span><p>{currentWord.definition}</p></div>
        <div className="word-relations"><span>RELATED WORDS</span><div>{[...currentWord.synonyms, ...currentWord.related].length ? [...currentWord.synonyms, ...currentWord.related].map((item) => <span className="word-chip" key={item}>{item}</span>) : <span className="word-muted">No related terms supplied for this sense.</span>}</div></div>
        <div className="word-navigation"><span>{filteredWords.length ? wordIndex + 1 : 0} / {filteredWords.length} matching entries</span><div><button disabled={wordIndex === 0} onClick={() => setWordIndex((i) => Math.max(0, i - 1))}>Previous</button><button disabled={wordIndex >= filteredWords.length - 1} onClick={() => setWordIndex((i) => Math.min(filteredWords.length - 1, i + 1))}>Next →</button></div></div>
      </article> : <div className="library-empty">No matching words. Try a broader search or another level.</div>}
      <p className="library-footnote">Dictionary records are organized by sense: the same spelling can have different meanings.</p>
    </div> : <div className="clinic-workspace">
      <div className="clinic-progress"><span>ERROR CLINIC</span><span>CASE {String(mistakeIndex + 1).padStart(2, "0")} / {String(mistakes.length).padStart(2, "0")}</span></div>
      <div className="clinic-tags"><span>{currentMistake.cefr}</span><span>{currentMistake.category.replaceAll("_", " ")}</span></div>
      <h3>Can you spot what needs to change?</h3>
      <div className="sentence-panel incorrect"><span>LEARNER SENTENCE</span><p>{currentMistake.learner_sentence}</p></div>
      {revealed ? <><div className="sentence-panel corrected"><span>IMPROVED VERSION</span><p>{currentMistake.corrected_sentence}</p></div><div className="explanation-panel"><span>THE PATTERN</span><p>{currentMistake.explanation}</p></div><div className="practice-panel"><span>MAKE IT YOURS</span><p>{currentMistake.practice_prompt}</p></div></> : <button className="reveal-button" onClick={() => setRevealed(true)}>Reveal correction and explanation</button>}
      <div className="clinic-actions"><button onClick={() => { setMistakeIndex((i) => (i + 1) % mistakes.length); setRevealed(false); }}>Next case →</button><span>Short explanations. Active practice. No score pressure.</span></div>
    </div>}
    <div className="library-attribution"><span>OPEN DATA · LOCAL DELIVERY · NO RUNTIME API CALLS</span><span>Content attribution is included in the repository.</span></div>
  </section>;
}
