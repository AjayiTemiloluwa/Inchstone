'use client'

import { useRef, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Scramble } from '@/components/ui/motion'
import { BottleMentionTextarea } from '@/components/ui/BottleMentionTextarea'
import { ReflectionPicker } from '@/components/ui/ReflectionPicker'

/**
 * Day reflection with an 800ms debounced auto-save. Render it with
 * key={goalId} so the saved text seeds the field whenever the goal changes.
 */
export function ReflectionCard({
  dateStr,
  goalId,
  initialText,
  onSave,
  onTemplateSaved,
}: {
  dateStr: string
  goalId: string | null
  initialText: string
  onSave: (text: string) => void
  onTemplateSaved: () => void
}) {
  const [text, setText] = useState(initialText)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = (next: string) => {
    if (!goalId) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSave(next), 800)
  }

  return (
    <Card className="p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-gold" />
        <h3 className="font-display font-bold text-ink"><Scramble text="Day Reflection" mono={false} /></h3>
      </div>
      <ReflectionPicker
        timePeriod="day"
        periodKey={dateStr}
        itemId={goalId}
        onSelect={content => setText(content)}
        onSaved={onTemplateSaved}
        className="mb-3"
      />
      <BottleMentionTextarea
        value={text}
        onChange={next => { setText(next); scheduleSave(next) }}
        placeholder="Reflect on today…  e.g. I did @Workout 400 press-ups"
        sourceRef={`day-${dateStr}`}
        className="w-full h-40 bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 transition-all"
      />
      <p className="text-[10px] text-ink/40">Auto-saves as you type — pick a saved template above to quick-fill.</p>
    </Card>
  )
}
