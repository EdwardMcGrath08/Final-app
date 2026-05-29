import { useEffect, useState } from 'react'
import './App.css'

const SHEET_URL = "https://script.google.com/macros/s/AKfycbydw1LtFoNz23-vPiSgj4az-pALA_kO88YlqvYE33YwJP7yyjPN47w7W1Xs8-F77_b9WA/exec"

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

  return {
    question,
    options,
    correctAnswer,
  }
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

function App() {
  const [quizQuestions, setQuizQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [score, setScore] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    let active = true

    const fetchQuestions = async () => {
      setLoading(true)
      setFetchError(null)

      try {
        const response = await fetch(SHEET_URL)
        if (!response.ok) {
          throw new Error(`Failed to load questions: ${response.status}`)
        }
        const json = await response.json()
        const parsed = parseSheetResponse(json)
        if (!parsed.length) {
          throw new Error('No questions found in the sheet response.')
        }
        if (active) {
          setQuizQuestions(parsed)
        }
      } catch (error) {
        if (active) {
          setFetchError(error.message || 'Unable to fetch quiz questions.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchQuestions()

    return () => {
      active = false
    }
  }, [])

  const currentQuestion = quizQuestions[currentIndex]

  const handleAnswer = (option) => {
    if (selectedAnswer !== null) return
    setSelectedAnswer(option)
    if (option === currentQuestion.correctAnswer) {
      setScore((prevScore) => prevScore + 1)
    }
  }

  const nextQuestion = () => {
    if (currentIndex + 1 < quizQuestions.length) {
      setCurrentIndex((prevIndex) => prevIndex + 1)
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
  }

  const retryFetch = () => {
    setLoading(true)
    setFetchError(null)
    setQuizQuestions([])
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setScore(0)
    setIsFinished(false)
    fetch(SHEET_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load questions: ${response.status}`)
        return response.json()
      })
      .then((json) => {
        const parsed = parseSheetResponse(json)
        if (!parsed.length) throw new Error('No questions found in the sheet response.')
        setQuizQuestions(parsed)
      })
      .catch((error) => setFetchError(error.message || 'Unable to fetch quiz questions.'))
      .finally(() => setLoading(false))
  }

  return (
    <div className="App">
      <header className="quiz-header">
        <h1>Multiple Choice Quiz</h1>
        <p>Answer the questions and see your score when you finish.</p>
      </header>

      <main className="quiz-container">
        {loading ? (
          <section className="result-card">
            <h2>Loading questions…</h2>
            <p>Please wait while we load the quiz from the provided sheet.</p>
          </section>
        ) : fetchError ? (
          <section className="result-card">
            <h2>Unable to load quiz</h2>
            <p>{fetchError}</p>
            <button onClick={retryFetch}>Retry</button>
          </section>
        ) : quizQuestions.length === 0 ? (
          <section className="result-card">
            <h2>No Questions Found</h2>
            <p>The sheet did not provide any valid quiz questions.</p>
          </section>
        ) : isFinished ? (
          <section className="result-card">
            <h2>Quiz Completed</h2>
            <p>
              You scored <strong>{score}</strong> out of <strong>{quizQuestions.length}</strong>
            </p>
            <button onClick={restartQuiz}>Try Again</button>
          </section>
        ) : (
          <section className="question-card">
            <div className="question-top">
              <span>
                Question {currentIndex + 1} of {quizQuestions.length}
              </span>
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
                  ? isCorrect
                    ? 'option correct'
                    : isSelected
                    ? 'option wrong'
                    : 'option'
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
                {currentIndex + 1 === quizQuestions.length ? 'See Score' : 'Next Question'}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
