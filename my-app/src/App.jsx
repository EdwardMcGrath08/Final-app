import { useEffect, useState } from 'react'
import './App.css'
 
const SHEET_URL = "https://script.google.com/macros/s/AKfycbxnmC2TSKOJQtfmK7cd_EURk1qAbUdYBC340bHDO-MxTYoJ53DeiuMdWv_wXkjkHMDFdQ/exec"
 
const normalizeKey = (key) => String(key).trim().toLowerCase().replace(/\s+/g, '')
 
const getValue = (row, keys) => {
  for (const key of keys) {
    const value = row[normalizeKey(key)]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value
    }
  }
  return undefined
}
 
const normalizeRow = (row) => {
  if (row && typeof row === 'object' && !Array.isArray(row)) {
    return Object.keys(row).reduce((acc, key) => {
      acc[normalizeKey(key)] = row[key]
      return acc
    }, {})
  }
  return {}
}
 
const parseOptionString = (value) => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  return String(value)
    .split(/\||,|;/)
    .map((item) => item.trim())
    .filter(Boolean)
}
 
const parseRow = (row) => {
  const normalized = normalizeRow(row)
  const question = String(
    getValue(normalized, ['question', 'prompt', 'title', 'questiontext', 'question_text']) || ''
  ).trim()
  const correctAnswer = String(
    getValue(normalized, ['correctanswer', 'correct answer', 'answer', 'correct', 'rightanswer']) || ''
  ).trim()
 
  let options = parseOptionString(getValue(normalized, ['options', 'choices', 'answers']))
  if (options.length === 0) {
    options = [
      getValue(normalized, ['optiona', 'optiona', 'a', 'choicea', 'choice a']),
      getValue(normalized, ['optionb', 'optionb', 'b', 'choiceb', 'choice b']),
      getValue(normalized, ['optionc', 'optionc', 'c', 'choicec', 'choice c']),
      getValue(normalized, ['optiond', 'optiond', 'd', 'choiced', 'choice d']),
    ]
      .filter((item) => item !== undefined && item !== null)
      .map((item) => String(item).trim())
      .filter(Boolean)
  }
 
  return { question, options, correctAnswer }
}
 
const shuffleArray = (array) => {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
 
const parseSheetResponse = (data) => {
  if (Array.isArray(data)) {
    return data.map(parseRow).filter((q) => q.question && q.options.length && q.correctAnswer)
  }
  if (data?.records && Array.isArray(data.records)) {
    return data.records.map(parseRow).filter((q) => q.question && q.options.length && q.correctAnswer)
  }
  if (data?.items && Array.isArray(data.items)) {
    return data.items.map(parseRow).filter((q) => q.question && q.options.length && q.correctAnswer)
  }
  if (data?.values && Array.isArray(data.values) && data.values.length > 1) {
    const [header, ...rows] = data.values
    const headers = header.map((cell) => normalizeKey(cell))
    return rows
      .map((row) => {
        const rowObject = headers.reduce((acc, key, index) => {
          acc[key] = row[index]
          return acc
        }, {})
        return parseRow(rowObject)
      })
      .filter((q) => q.question && q.options.length && q.correctAnswer)
  }
  return []
}
 
const getRank = (score, total) => {
  const pct = score / total
  if (pct === 1)   return { label: 'RADIANT', color: '#ff4655' }
  if (pct >= 0.8)  return { label: 'IMMORTAL', color: '#c89bff' }
  if (pct >= 0.6)  return { label: 'DIAMOND',  color: '#9bbdff' }
  if (pct >= 0.4)  return { label: 'PLATINUM', color: '#4fc7b8' }
  if (pct >= 0.2)  return { label: 'GOLD',     color: '#f5c842' }
  return             { label: 'IRON',     color: '#8a9bb0' }
}
 
/* ─── SVG ICONS ──────────────────────────────────────── */
 
const ValLogoIcon = () => (
  <svg className="val-logo-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,5 95,95 50,75 5,95" fill="#ff4655"/>
    <polygon points="50,5 95,95 50,75" fill="#c0392b"/>
  </svg>
)
 
const AgentIcon = ({ rank }) => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="36" stroke={rank.color} strokeWidth="1.5" strokeDasharray="4 3"/>
    <polygon points="40,12 68,68 40,56 12,68" fill={rank.color} opacity="0.9"/>
    <polygon points="40,12 68,68 40,56" fill={rank.color} opacity="0.5"/>
  </svg>
)
 
/* ─── MAIN APP ───────────────────────────────────────── */
 
function App() {
  const [quizQuestions, setQuizQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [score, setScore] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
 
  const doFetch = () => {
    setLoading(true)
    setFetchError(null)
    let active = true
 
    fetch(SHEET_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load questions: ${response.status}`)
        return response.json()
      })
      .then((json) => {
        const parsed = parseSheetResponse(json)
        if (!parsed.length) throw new Error('No questions found in the sheet response.')
        if (active) {
          setQuizQuestions(
            shuffleArray(parsed).map((q) => ({ ...q, options: shuffleArray(q.options) }))
          )
        }
      })
      .catch((error) => {
        if (active) setFetchError(error.message || 'Unable to fetch quiz questions.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
 
    return () => { active = false }
  }
 
  useEffect(() => {
    return doFetch()
  }, [])
 
  const currentQuestion = quizQuestions[currentIndex]
 
  const handleAnswer = (option) => {
    if (selectedAnswer !== null) return
    setSelectedAnswer(option)
    if (option === currentQuestion.correctAnswer) {
      setScore((prev) => prev + 1)
    }
  }
 
  const nextQuestion = () => {
    if (currentIndex + 1 < quizQuestions.length) {
      setCurrentIndex((prev) => prev + 1)
      setSelectedAnswer(null)
    } else {
      setIsFinished(true)
    }
  }
 
  const restartQuiz = () => {
    setCurrentIndex(0)
    setScore(0)
    setSelectedAnswer(null)
    setIsFinished(false)
    setQuizQuestions((prev) =>
      shuffleArray(prev).map((q) => ({ ...q, options: shuffleArray(q.options) }))
    )
  }
 
  const rank = isFinished ? getRank(score, quizQuestions.length) : null
 
  return (
    <div className="App">
      {/* Decorative side strip */}
      <div className="side-strip">
        <div className="strip-line" />
        <div className="strip-diamond" />
        <span className="strip-text">Valorant</span>
        <div className="strip-diamond" />
        <div className="strip-line" />
      </div>
 
      <header className="quiz-header">
        <div className="val-logo">
          <ValLogoIcon />
          <h1><span>Val</span>Quiz</h1>
        </div>
        <p>Test your knowledge. Prove your rank.</p>
      </header>
 
      <main className="quiz-container">
        {loading ? (
          <section className="result-card">
            <h2>Initializing Protocol</h2>
            <p>Loading intel from the databank…</p>
            <div className="loading-dots">
              <span /><span /><span />
            </div>
          </section>
        ) : fetchError ? (
          <section className="result-card">
            <h2>Connection Lost</h2>
            <p>{fetchError}</p>
            <button onClick={doFetch}>Reconnect</button>
          </section>
        ) : quizQuestions.length === 0 ? (
          <section className="result-card">
            <h2>No Intel Found</h2>
            <p>The databank returned no valid questions.</p>
          </section>
        ) : isFinished ? (
          <section className="result-card">
            <div className="result-agent">
              <AgentIcon rank={rank} />
            </div>
            <div className="result-rank" style={{ color: rank.color }}>
              — Rank Achieved: {rank.label} —
            </div>
            <h2>Round Complete</h2>
            <p className="result-score">
              Score:
              <strong className="highlight">{score}</strong>
              /
              <strong>{quizQuestions.length}</strong>
            </p>
            <button onClick={restartQuiz}>Play Again</button>
          </section>
        ) : (
          <section className="question-card" key={currentIndex}>
            <div className="question-top">
              <span>Round {currentIndex + 1} / {quizQuestions.length}</span>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${((currentIndex + 1) / quizQuestions.length) * 100}%` }}
                />
              </div>
            </div>
 
            <h2>{currentQuestion.question}</h2>
 
            <div className="options">
              {currentQuestion.options.map((option) => {
                const isCorrect = option === currentQuestion.correctAnswer
                const isSelected = option === selectedAnswer
                const className = selectedAnswer
                  ? isCorrect ? 'option correct' : isSelected ? 'option wrong' : 'option'
                  : 'option'
 
                return (
                  <button
                    key={option}
                    className={className}
                    onClick={() => handleAnswer(option)}
                    disabled={selectedAnswer !== null}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
 
            <div className="action-row">
              <button onClick={nextQuestion} disabled={selectedAnswer === null}>
                {currentIndex + 1 === quizQuestions.length ? 'See Results' : 'Next Round'}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
 
export default App
 