'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { X, Download, Save } from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'

interface RichNoteModalProps {
    onClose: () => void
    onSaved: () => void
    note?: {
        id: string
        title: string
        content: string
        itemId?: string
    } | null
    defaultDate?: string
}

export function RichNoteModal({ onClose, onSaved, note, defaultDate }: RichNoteModalProps) {
    const [title, setTitle] = useState(note?.title || '')
    const [noteDate, setNoteDate] = useState(defaultDate || '')
    const [saving, setSaving] = useState(false)
    const { showToast } = useToast()

    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
    }, [])

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'Start writing your note...',
            }),
        ],
        content: note?.content || '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3',
            },
        },
    })

    useEffect(() => {
        if (editor && note?.content) {
            editor.commands.setContent(note.content)
        }
    }, [editor, note])

    if (!isClient) {
        return null
    }

    const handleSave = async () => {
        if (!title.trim()) {
            showToast('Title is required', 'error')
            return
        }
        setSaving(true)
        try {
            const content = editor?.getHTML() || ''
            const res = await fetch('/api/notes', {
                method: note?.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: note?.id,
                    title: title.trim(),
                    content,
                    itemId: null,
                    date: noteDate || null,
                }),
            })
            if (res.ok) {
                onSaved()
                onClose()
                showToast('Note saved successfully', 'success')
            } else {
                showToast('Failed to save note. Please try again.', 'error')
            }
        } catch (err) {
            showToast('Network error. Please try again.', 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleDownloadPDF = async () => {
        if (!editor) return

        // Create a temporary container for proper PDF rendering without affecting the UI
        const container = document.createElement('div')
        container.innerHTML = `
            <div style="font-family: sans-serif; padding: 40px; color: #000;">
                <h1 style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">${title || 'Untitled Note'}</h1>
                ${editor.getHTML()}
            </div>
        `

        try {
            showToast('Generating PDF...', 'info')
            const jsPDF = (await import('jspdf')).default
            const doc = new jsPDF('p', 'mm', 'a4')
            const pageWidth = doc.internal.pageSize.getWidth()
            const margin = 20
            let y = 20

            doc.setFontSize(18)
            doc.setTextColor(212, 175, 55)
            doc.setFont('helvetica', 'bold')
            doc.text(title || 'Note', margin, y)
            y += 10

            doc.setFontSize(11)
            doc.setTextColor(30, 30, 30)
            doc.setFont('helvetica', 'normal')
            doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy')}`, margin, y)
            y += 8

            doc.setDrawColor(200, 200, 200)
            doc.setLineWidth(0.3)
            doc.line(margin, y, pageWidth - margin, y)
            y += 8

            // Get text content from the editor
            const textContent = editor.getText() || ''
            const lines = doc.splitTextToSize(textContent, pageWidth - margin * 2)

            doc.setFontSize(10)
            doc.setTextColor(30, 30, 30)
            doc.setFont('helvetica', 'normal')

            lines.forEach((line: string) => {
                if (y > 275) {
                    doc.addPage()
                    y = 20
                }
                doc.text(line, margin, y)
                y += 5
            })

            doc.setFontSize(7)
            doc.setTextColor(200, 200, 200)
            doc.setFont('helvetica', 'italic')
            doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy h:mm a')}`, margin, 285)

            doc.save(`${title || 'note'}.pdf`)
            showToast('PDF downloaded successfully', 'success')
        } catch (err) {
            console.error('PDF export failed:', err)
            showToast('Failed to export PDF', 'error')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[8px] border border-gold-dim/25 bg-surface-solid">
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-gold-dim/20 px-6 py-4">
                    <h3 className="text-lg font-semibold text-parchment">{note?.id ? 'Edit Note' : 'New Note'}</h3>
                    <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-md text-parchment/50 transition-colors hover:text-parchment">
                        <X className="h-5 w-5" strokeWidth={1.5} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 space-y-5 overflow-y-auto p-6" data-lenis-prevent>
                    <div>
                        <label className="mb-1.5 block text-xs text-parchment/55">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full rounded-[6px] border border-gold-dim/25 bg-ink p-3 text-sm text-parchment transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                            placeholder="Note title..."
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs text-parchment/55">Link to date (optional)</label>
                        <input
                            type="date"
                            value={noteDate}
                            onChange={e => setNoteDate(e.target.value)}
                            className="w-full rounded-[6px] border border-gold-dim/25 bg-ink p-3 text-sm text-parchment transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs text-parchment/55">Content</label>
                        <div className="overflow-hidden rounded-[6px] border border-gold-dim/25 bg-ink">
                            {editor && (
                                <div className="flex items-center gap-1 border-b border-gold-dim/20 bg-mist px-3 py-2">
                                    <button onClick={() => editor.chain().focus().toggleBold().run()} className={`flex h-9 min-w-9 items-center justify-center rounded-md transition-colors ${editor.isActive('bold') ? 'bg-gold/20 text-gold' : 'text-parchment/70 hover:bg-mist'}`}>
                                        <span className="text-xs font-bold px-1">B</span>
                                    </button>
                                    <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`flex h-9 min-w-9 items-center justify-center rounded-md transition-colors ${editor.isActive('italic') ? 'bg-gold/20 text-gold' : 'text-parchment/70 hover:bg-mist'}`}>
                                        <span className="px-1 italic text-xs">I</span>
                                    </button>
                                    <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`flex h-9 min-w-9 items-center justify-center rounded-md transition-colors ${editor.isActive('bulletList') ? 'bg-gold/20 text-gold' : 'text-parchment/70 hover:bg-mist'}`}>
                                        <span className="px-1 text-xs">• List</span>
                                    </button>
                                    <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`flex h-9 min-w-9 items-center justify-center rounded-md transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-gold/20 text-gold' : 'text-parchment/70 hover:bg-mist'}`}>
                                        <span className="px-1 text-xs font-bold">H2</span>
                                    </button>
                                </div>
                            )}
                            <EditorContent editor={editor} className="text-parchment" />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-between border-t border-gold-dim/20 px-6 py-4">
                    <button onClick={handleDownloadPDF} className="flex items-center gap-2 rounded-md px-4 py-2 text-sm text-parchment/70 transition-colors hover:text-[#cf8f78]">
                        <Download className="w-4 h-4" strokeWidth={1.5} />
                        <span>Download PDF</span>
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="rounded-md px-5 py-2.5 text-sm text-parchment/70 transition-colors hover:text-parchment">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving || !title.trim()} className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-[#cbaa6f] disabled:opacity-50 flex items-center gap-2">
                            <Save className="w-4 h-4" strokeWidth={1.5} />
                            <span>{saving ? 'Saving...' : 'Save Note'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
