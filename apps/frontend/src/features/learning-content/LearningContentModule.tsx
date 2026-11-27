import { useMemo, useState } from "react";
import wordsData from "./data/vocabulary.json";
import mistakesData from "./data/common-mistakes.json";
import a2PersonalGoalsLesson from "./data/a2-personal-goals.json";
import grammarExercisePack from "../../../../../packages/learning-core/examples/grammar-exercise-pack.json";
import "./learning-content.css";

type WordEntry = { word: string; sense: string; pos: string; definition: string; level: 1 | 2 | 3; synonyms: string[]; related: string[] };
type MistakeEntry = { id: string; category: string; cefr: string; learner_sentence: string; corrected_sentence: string; explanation: string; practice_prompt: string; tags: string[] };
type ExerciseItem = { id: string; type: string; level: string; prompt: string; tags: string[]; options?: Array<{ id: string; text: string }>; correctOptionId?: string; acceptedAnswers?: string[]; tokens?: string[]; correctOrder?: string[]; sourceText?: string; instruction?: string; correctedText?: string; explanation?: string; pairs?: Array<{ left: string; right: string }>; front?: string; back?: string; feedback?: string };
type Tab = "vocabulary" | "correction" | "lesson" | "exercises";
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
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [exerciseAnswer, setExerciseAnswer] = useState("");
  const [exerciseRevealed, setExerciseRevealed] = useState(false);
  const exercises = grammarExercisePack.items as ExerciseItem[];
  const currentExercise = exercises[exerciseIndex];
  const normalizeExerciseAnswer = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  const exerciseIsCorrect = currentExercise.type === "multiple-choice"
    ? exerciseAnswer === currentExercise.correctOptionId
    : currentExercise.type === "gap-fill"
      ? (currentExercise.acceptedAnswers ?? []).some((answer) => normalizeExerciseAnswer(answer) === normalizeExerciseAnswer(exerciseAnswer))
      : currentExercise.type === "reorder"
        ? normalizeExerciseAnswer(exerciseAnswer) === normalizeExerciseAnswer((currentExercise.correctOrder ?? []).join(" "))
        : currentExercise.type === "transformation"
          ? (currentExercise.acceptedAnswers ?? []).some((answer) => normalizeExerciseAnswer(answer) === normalizeExerciseAnswer(exerciseAnswer))
          : currentExercise.type === "error-spotting"
            ? normalizeExerciseAnswer(exerciseAnswer) === normalizeExerciseAnswer(currentExercise.correctedText ?? "")
            : false;
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
    <div className="library-tabs" role="group" aria-label="Learning tools">
      <button aria-pressed={tab === "vocabulary"} className={tab === "vocabulary" ? "active" : ""} onClick={() => setTab("vocabulary")}><span>01</span> Vocabulary</button>
      <button aria-pressed={tab === "correction"} className={tab === "correction" ? "active" : ""} onClick={() => { setTab("correction"); setRevealed(false); }}><span>02</span> Error clinic</button>
      <button aria-pressed={tab === "lesson"} className={tab === "lesson" ? "active" : ""} onClick={() => setTab("lesson")}><span>03</span> A2 lesson</button>
      <button aria-pressed={tab === "exercises"} className={tab === "exercises" ? "active" : ""} onClick={() => { setTab("exercises"); setExerciseRevealed(false); setExerciseAnswer(""); }}><span>04</span> Grammar practice</button>
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
    </div> : tab === "correction" ? <div className="clinic-workspace">
      <div className="clinic-progress"><span>ERROR CLINIC</span><span>CASE {String(mistakeIndex + 1).padStart(2, "0")} / {String(mistakes.length).padStart(2, "0")}</span></div>
      <div className="clinic-tags"><span>{currentMistake.cefr}</span><span>{currentMistake.category.replaceAll("_", " ")}</span></div>
      <h3>Can you spot what needs to change?</h3>
      <div className="sentence-panel incorrect"><span>LEARNER SENTENCE</span><p>{currentMistake.learner_sentence}</p></div>
      {revealed ? <><div className="sentence-panel corrected"><span>IMPROVED VERSION</span><p>{currentMistake.corrected_sentence}</p></div><div className="explanation-panel"><span>THE PATTERN</span><p>{currentMistake.explanation}</p></div><div className="practice-panel"><span>MAKE IT YOURS</span><p>{currentMistake.practice_prompt}</p></div></> : <button className="reveal-button" onClick={() => setRevealed(true)}>Reveal correction and explanation</button>}
      <div className="clinic-actions"><button onClick={() => { setMistakeIndex((i) => (i + 1) % mistakes.length); setRevealed(false); }}>Next case →</button><span>Short explanations. Active practice. No score pressure.</span></div>
    </div> : tab === "lesson" ? <div className="lesson-preview-workspace">
      <div className="lesson-preview-header"><span>A2 · COMMUNICATIVE SPEAKING</span><h3>{a2PersonalGoalsLesson.title}</h3><p>{a2PersonalGoalsLesson.communicativeOutcome}</p></div>
      <div className="lesson-task"><span>REAL-WORLD TASK</span><p>{a2PersonalGoalsLesson.realWorldTask}</p></div>
      <div className="lesson-targets"><span>TARGET LANGUAGE</span><div>{a2PersonalGoalsLesson.targetLanguage.map((item) => <span className="word-chip" key={item}>{item}</span>)}</div></div>
      <div className="lesson-stage-list"><span className="lesson-stage-label">THE 8-STAGE LEARNING SEQUENCE</span>{a2PersonalGoalsLesson.stages.map((stage, index) => <article className="lesson-stage" key={stage.type}><span className="lesson-stage-number">{String(index + 1).padStart(2, "0")}</span><div><h4>{stage.type.replaceAll("-", " ")}</h4><p>{stage.activity}</p><small>Evidence: {stage.expectedEvidence}</small></div></article>)}</div>
      <div className="lesson-mastery"><strong>Mastery gate</strong><span>{a2PersonalGoalsLesson.mastery.minimumAttempts}+ attempts · {a2PersonalGoalsLesson.mastery.minimumScorePercent}% threshold · delayed recall required</span></div>
      <p className="library-footnote">Original EnglishCode lesson sample. CEFR-informed, not an official CEFR examination or certified assessment.</p>
    </div> : <div className="exercise-workspace">
      <div className="exercise-heading"><span>EXERCISE PACK · A2</span><h3>{grammarExercisePack.title}</h3><p>Short, self-checking activities across seven exercise formats. Your answers stay in this browser session.</p></div>
      <div className="exercise-progress"><span>{String(exerciseIndex + 1).padStart(2, "0")} / {String(exercises.length).padStart(2, "0")}</span><span>{currentExercise.type.replaceAll("-", " ")}</span></div>
      <article className="exercise-card">
        <div className="exercise-tags">{currentExercise.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <h4>{currentExercise.prompt}</h4>
        {currentExercise.type === "multiple-choice" && <div className="exercise-options">{currentExercise.options?.map((option) => <button key={option.id} className={exerciseAnswer === option.id ? "selected" : ""} aria-pressed={exerciseAnswer === option.id} onClick={() => { setExerciseAnswer(option.id); setExerciseRevealed(false); }}>{option.text}</button>)}</div>}
        {currentExercise.type === "gap-fill" && <><p className="exercise-source">{currentExercise.prompt}</p><input className="exercise-input" value={exerciseAnswer} onChange={(event) => { setExerciseAnswer(event.target.value); setExerciseRevealed(false); }} placeholder="Type the missing word" aria-label="Your answer" /></>}
        {currentExercise.type === "reorder" && <><p className="exercise-source">{currentExercise.tokens?.join(" · ")}</p><input className="exercise-input" value={exerciseAnswer} onChange={(event) => { setExerciseAnswer(event.target.value); setExerciseRevealed(false); }} placeholder="Write the sentence in order" aria-label="Your sentence order" /></>}
        {(currentExercise.type === "transformation" || currentExercise.type === "error-spotting") && <><p className="exercise-source">{currentExercise.sourceText}</p>{currentExercise.instruction && <p className="exercise-instruction">{currentExercise.instruction}</p>}<input className="exercise-input" value={exerciseAnswer} onChange={(event) => { setExerciseAnswer(event.target.value); setExerciseRevealed(false); }} placeholder="Write your answer" aria-label="Your answer" /></>}
        {currentExercise.type === "matching" && <div className="exercise-pairs">{currentExercise.pairs?.map((pair) => <div key={pair.left}><span>{pair.left}</span><span>{exerciseRevealed ? pair.right : "•••"}</span></div>)}</div>}
        {currentExercise.type === "flashcard" && <div className="exercise-flashcard"><strong>{currentExercise.front}</strong>{exerciseRevealed && <p>{currentExercise.back}</p>}</div>}
        {exerciseRevealed && <div className="exercise-answer"><span>ANSWER / FEEDBACK</span>{currentExercise.type !== "matching" && currentExercise.type !== "flashcard" && <p className={exerciseIsCorrect ? "exercise-correct" : "exercise-incorrect"}>{exerciseIsCorrect ? "Your answer matches an accepted answer." : "Review the correct answer and feedback."}</p>}<p>{currentExercise.type === "multiple-choice" ? currentExercise.options?.find((option) => option.id === currentExercise.correctOptionId)?.text : currentExercise.type === "gap-fill" ? currentExercise.acceptedAnswers?.join(" / ") : currentExercise.type === "reorder" ? currentExercise.correctOrder?.join(" ") : currentExercise.type === "transformation" ? currentExercise.acceptedAnswers?.join(" / ") : currentExercise.type === "error-spotting" ? currentExercise.correctedText : currentExercise.type === "matching" ? "The matching pairs are shown above." : currentExercise.back}</p>{currentExercise.explanation && <p>{currentExercise.explanation}</p>}{currentExercise.feedback && <p>{currentExercise.feedback}</p>}</div>}
        {currentExercise.type !== "matching" && currentExercise.type !== "flashcard" && <button className="exercise-reveal" onClick={() => setExerciseRevealed(true)} disabled={!exerciseAnswer.trim()}>Check answer</button>}
        {(currentExercise.type === "matching" || currentExercise.type === "flashcard") && <button className="exercise-reveal" onClick={() => setExerciseRevealed((value) => !value)}>{exerciseRevealed ? "Hide answer" : "Reveal answer"}</button>}
      </article>
      <div className="exercise-navigation"><button disabled={exerciseIndex === 0} onClick={() => { setExerciseIndex((i) => Math.max(0, i - 1)); setExerciseAnswer(""); setExerciseRevealed(false); }}>Previous</button><button disabled={exerciseIndex >= exercises.length - 1} onClick={() => { setExerciseIndex((i) => Math.min(exercises.length - 1, i + 1)); setExerciseAnswer(""); setExerciseRevealed(false); }}>Next exercise →</button></div>
      <p className="library-footnote">Original EnglishCode examples. Exercise formats are inspired by publicly documented categories in Grammar Drill Yard; no upstream code or lesson text is copied.</p>
    </div>}
    <div className="library-attribution"><span>OPEN DATA · LOCAL DELIVERY · NO RUNTIME API CALLS</span><span>Content attribution is included in the repository.</span></div>
  </section>;
}
