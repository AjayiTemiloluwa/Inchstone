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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
            <div className="bg-paper w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-mist">
                    <h3 className="font-bold text-ink">Nudge {partnerName}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-mist rounded-full transition-colors">
                        <X className="w-5 h-5 text-ink/60" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    {sent ? (
                        <div className="text-center py-8">
                            <Send className="w-12 h-12 mx-auto text-sage mb-3" />
                            <p className="font-semibold text-sage">Nudge sent!</p>
                        </div>
                    ) : (
                        <>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Send a quick message to your partner..."
                                className="w-full rounded-lg border border-mist p-3 text-sm bg-surface h-28 resize-none"
                                maxLength={500}
                            />
                            <p className="text-xs text-ink/40 text-right">{message.length}/500</p>
                            <button
                                onClick={handleSend}
                                disabled={sending || !message.trim()}
                                className="w-full py-2.5 bg-gold text-surface font-semibold rounded-lg hover:bg-gold/90 transition disabled:opacity-50 flex items-center justify-center space-x-2"
                            >
                                {sending ? (
                                    <span>Sending...</span>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
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