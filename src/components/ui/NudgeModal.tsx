'use client'

import { useState } from 'react'
import { X, Send } from 'lucide-react'

interface NudgeModalProps {
    partnerId: string
    partnerName: string
    onClose: () => void
    onSent: () => void
}

export function NudgeModal({ partnerId, partnerName, onClose, onSent }: NudgeModalProps) {
    const [message, setMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)

    const handleSend = async () => {
        if (!message.trim()) return
        setSending(true)
        try {
            const res = await fetch('/api/nudges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerId, message: message.trim() }),
            })
            if (res.ok) {
                setSent(true)
                onSent()
                setTimeout(onClose, 1500)
            }
        } catch (err) {
            console.error('Failed to send nudge', err)
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-[8px] border border-gold-dim/25 bg-surface-solid">
                <div className="flex items-center justify-between border-b border-gold-dim/20 px-6 py-4">
                    <h3 className="font-semibold text-parchment">Nudge {partnerName}</h3>
                    <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-md text-parchment/50 transition-colors hover:text-parchment">
                        <X className="h-5 w-5" strokeWidth={1.5} />
                    </button>
                </div>
                <div className="space-y-4 p-6">
                    {sent ? (
                        <div className="py-8 text-center">
                            <Send className="mx-auto mb-3 h-12 w-12 text-moss" strokeWidth={1.5} />
                            <p className="font-semibold text-moss">Nudge sent!</p>
                        </div>
                    ) : (
                        <>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Send a quick message to your partner..."
                                className="h-28 w-full resize-none rounded-[6px] border border-gold-dim/25 bg-ink p-3 text-sm text-parchment transition-colors placeholder:text-parchment/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                                maxLength={500}
                            />
                            <p className="text-right font-mono text-xs text-parchment/40">{message.length}/500</p>
                            <button
                                onClick={handleSend}
                                disabled={sending || !message.trim()}
                                className="w-full rounded-md bg-gold py-2.5 font-semibold text-ink transition-colors hover:bg-[#cbaa6f] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {sending ? (
                                    <span>Sending…</span>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" strokeWidth={1.5} />
                                        <span>Send Nudge</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
