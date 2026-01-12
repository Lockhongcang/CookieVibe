import { Button } from 'antd'

const DEFAULT_SUGGESTIONS = [
  'không make',
  'make Thu Ngân',
  'make Sun Sun',
  'make Tường Vy',
  'make',
  'chưa có người make'
]

const applySuggestion = (currentValue, suggestion) => {
  const current = String(currentValue || '')
  if (!current.trim()) return suggestion

  const normalized = current.replace(/\s+$/g, '')
  return `${normalized}\n${suggestion}`
}

export default function QuickNoteSuggestions({
  value,
  onChange,
  disabled = false,
  suggestions = DEFAULT_SUGGESTIONS,
  label = 'Gợi ý nhanh'
}) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return null

  return (
    <div className="cv-quickNoteSuggestionsWrap">
      {label ? <div className="cv-quickNoteSuggestionsLabel">{label}:</div> : null}
      <div className="cv-quickNoteSuggestions">
        {suggestions.map((text) => (
          <Button
            key={text}
            size="small"
            type="default"
            className="cv-quickNoteBtn"
            onClick={() => {
              if (disabled) return
              const next = applySuggestion(value, text)
              onChange?.(next)
            }}
            disabled={disabled}
          >
            {text}
          </Button>
        ))}
      </div>
    </div>
  )
}
