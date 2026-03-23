'use client'

import { useState, useRef } from 'react'

export interface AiStyleConfig {
  tone: 'friendly' | 'professional' | 'casual'
  emojiLevel: 'none' | 'light' | 'heavy'
  customInstructions: string
  screenshotFile?: File | null
}

const TONE_OPTIONS: { value: AiStyleConfig['tone']; label: string; description: string }[] = [
  {
    value: 'friendly',
    label: 'ידידותי',
    description: 'חם, נגיש ומזמין. מתאים לרוב העסקים.',
  },
  {
    value: 'professional',
    label: 'מקצועי',
    description: 'רשמי, מדויק ומכבד. מתאים לשירותים מקצועיים.',
  },
  {
    value: 'casual',
    label: 'קז\'ואל',
    description: 'משוחרר וקליל. מתאים לקהל צעיר.',
  },
]

const EMOJI_OPTIONS: { value: AiStyleConfig['emojiLevel']; label: string; example: string }[] = [
  {
    value: 'none',
    label: 'ללא',
    example: 'שלום, נשמח לקבוע לך תור.',
  },
  {
    value: 'light',
    label: 'מעט',
    example: 'היי! נשמח לקבוע לך תור ✨',
  },
  {
    value: 'heavy',
    label: 'הרבה',
    example: 'היי!! 🤩 נשמח לקבוע לך תור! 💇‍♀️✨🎉',
  },
]

interface StepAiStyleProps {
  initialConfig?: Partial<AiStyleConfig>
  onChange: (config: AiStyleConfig) => void
}

export default function StepAiStyle({ initialConfig, onChange }: StepAiStyleProps) {
  const [tone, setTone] = useState<AiStyleConfig['tone']>(initialConfig?.tone || 'friendly')
  const [emojiLevel, setEmojiLevel] = useState<AiStyleConfig['emojiLevel']>(initialConfig?.emojiLevel || 'light')
  const [customInstructions, setCustomInstructions] = useState(initialConfig?.customInstructions || '')
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const emitChange = (updates: Partial<AiStyleConfig>) => {
    const config: AiStyleConfig = {
      tone,
      emojiLevel,
      customInstructions,
      screenshotFile,
      ...updates,
    }
    onChange(config)
  }

  const handleTone = (value: AiStyleConfig['tone']) => {
    setTone(value)
    emitChange({ tone: value })
  }

  const handleEmoji = (value: AiStyleConfig['emojiLevel']) => {
    setEmojiLevel(value)
    emitChange({ emojiLevel: value })
  }

  const handleInstructions = (value: string) => {
    setCustomInstructions(value)
    emitChange({ customInstructions: value })
  }

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setScreenshotFile(file)
      const url = URL.createObjectURL(file)
      setScreenshotPreview(url)
      emitChange({ screenshotFile: file })
    }
  }

  const removeScreenshot = () => {
    setScreenshotFile(null)
    setScreenshotPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    emitChange({ screenshotFile: null })
  }

  return (
    <div className="space-y-8">
      {/* Tone selector */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-text">סגנון שיחה</h3>
        <p className="text-sm text-text-secondary">
          איך ה-AI ידבר עם הלקוחות שלך?
        </p>

        <div className="space-y-2">
          {TONE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleTone(option.value)}
              className={`w-full text-start p-4 rounded-[var(--radius-card)] border-2 transition-all ${
                tone === option.value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                  : 'border-border bg-white hover:border-[var(--color-primary)]/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    tone === option.value
                      ? 'border-[var(--color-primary)]'
                      : 'border-border'
                  }`}
                >
                  {tone === option.value && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-text text-sm">{option.label}</div>
                  <div className="text-xs text-text-secondary mt-0.5">{option.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Emoji level */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-text">רמת אימוג'ים</h3>
        <p className="text-sm text-text-secondary">
          כמה אימוג'ים ה-AI ישתמש בשיחות?
        </p>

        <div className="grid grid-cols-3 gap-2">
          {EMOJI_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleEmoji(option.value)}
              className={`p-3 rounded-[var(--radius-button)] border-2 text-center transition-all ${
                emojiLevel === option.value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                  : 'border-border bg-white hover:border-[var(--color-primary)]/40'
              }`}
            >
              <div className="font-medium text-text text-sm">{option.label}</div>
            </button>
          ))}
        </div>

        {/* Example preview */}
        <div className="bg-surface rounded-[var(--radius-card)] p-4">
          <p className="text-xs text-text-muted mb-2">תצוגה מקדימה:</p>
          <div className="bg-[var(--color-primary-light)] text-text text-sm rounded-2xl rounded-ts-sm px-4 py-2 inline-block max-w-[80%]">
            {EMOJI_OPTIONS.find((o) => o.value === emojiLevel)?.example}
          </div>
        </div>
      </div>

      {/* Custom instructions */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-text">הנחיות מותאמות אישית</h3>
        <p className="text-sm text-text-secondary">
          יש לך הוראות מיוחדות ל-AI? למשל: "תמיד תציע ללקוחות להירשם למועדון"
        </p>
        <textarea
          value={customInstructions}
          onChange={(e) => handleInstructions(e.target.value)}
          placeholder="כתוב כאן הנחיות נוספות (אופציונלי)..."
          rows={4}
          className="w-full px-4 py-3 rounded-[var(--radius-button)] border border-border bg-white text-text placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors resize-none"
        />
      </div>

      {/* Screenshot upload */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-text">צילום מסך לדוגמה</h3>
        <p className="text-sm text-text-secondary">
          יש לך צילום מסך של שיחת וואטסאפ שמייצגת את הסגנון הרצוי? העלה אותו וה-AI ילמד ממנו.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleScreenshot}
          className="hidden"
          id="screenshot-upload"
        />

        {screenshotPreview ? (
          <div className="relative">
            <img
              src={screenshotPreview}
              alt="צילום מסך"
              className="w-full max-h-64 object-contain rounded-[var(--radius-card)] border border-border"
            />
            <button
              type="button"
              onClick={removeScreenshot}
              className="absolute top-2 start-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-danger hover:bg-danger-bg transition-colors shadow-sm"
              aria-label="הסר צילום מסך"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <label
            htmlFor="screenshot-upload"
            className="block w-full py-8 px-4 rounded-[var(--radius-card)] border-2 border-dashed border-border text-center cursor-pointer hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]/30 transition-all"
          >
            <svg
              className="w-10 h-10 mx-auto text-text-muted mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
            <span className="text-sm text-text-secondary">לחץ להעלאת צילום מסך</span>
            <span className="block text-xs text-text-muted mt-1">JPG, PNG, WebP (אופציונלי)</span>
          </label>
        )}
      </div>
    </div>
  )
}
