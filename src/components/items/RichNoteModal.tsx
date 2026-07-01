'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { X, Download, Save } from 'lucide-react'
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
    const [itemId, setItemId] = useState(note?.itemId || '')
    const [saving, setSaving] = useState(false)
    const { showToast } = useToast()

    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
    }, [])

    const editor = useEditor({
        extensions: [StarterKit],
        content: note?.content || '<p>Start writing your note...</p>',
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3',
            },
        },
    })

    if (!isClient) {
        return null
    }

    useEffect(() => {
        if (editor && note?.content) {
            editor.commands.setContent(note.content)
        }
    }, [editor, note])

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
                    itemId: itemId || null,
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

        const opt = {
            margin: 1,
            filename: `${title || 'note'}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
        }

        try {
            showToast('Generating PDF...', 'info')
            const html2pdf = (await import('html2pdf.js')).default
            await html2pdf().set(opt as any).from(container).save()
            showToast('PDF downloaded successfully', 'success')
        } catch (err) {
            console.error('PDF export failed:', err)
            showToast('Failed to export PDF', 'error')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn">
            <div className="glass rounded-3xl border border-white/20 shadow-2xl shadow-black/50 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-slideUp">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-white/10">
                    <h3 className="text-xl font-display font-bold text-ink">{note?.id ? 'Edit Note' : 'New Note'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-ink/50 hover:text-ink">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-5 overflow-y-auto flex-1">
                    <div>
                        <label className="text-xs font-bold text-ink/70 mb-2 block uppercase tracking-wider">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full rounded-xl border border-white/10 p-3 text-sm bg-black/20 focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all text-ink"
                            placeholder="Note title..."
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-ink/70 mb-2 block uppercase tracking-wider">Link to Date (optional)</label>
                        <input
                            type="date"
                            value={itemId ? '' : defaultDate || ''}
                            onChange={e => setItemId(e.target.value)}
                            className="w-full rounded-xl border border-white/10 p-3 text-sm bg-black/20 focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all text-ink/80"
                            placeholder="Link to day"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-ink/70 mb-2 block uppercase tracking-wider">Content</label>
                        <div className="border border-white/10 rounded-xl bg-black/20 overflow-hidden">
                            {editor && (
                                <div className="flex items-center space-x-1 px-3 py-2 border-b border-white/10 bg-black/40">
                                    <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${editor.isActive('bold') ? 'bg-white/20 text-gold' : 'text-ink/70'}`}>
                                        <span className="text-xs font-bold px-1">B</span>
                                    </button>
                                    <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${editor.isActive('italic') ? 'bg-white/20 text-gold' : 'text-ink/70'}`}>
                                        <span className="text-xs italic px-1">I</span>
                                    </button>
                                    <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${editor.isActive('bulletList') ? 'bg-white/20 text-gold' : 'text-ink/70'}`}>
                                        <span className="text-xs px-1">• List</span>
                                    </button>
                                    <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-white/20 text-gold' : 'text-ink/70'}`}>
                                        <span className="text-xs font-bold px-1">H2</span>
                                    </button>
                                </div>
                            )}
                            <EditorContent editor={editor} className="text-ink" />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-8 py-5 border-t border-white/10 bg-black/20">
                    <button onClick={handleDownloadPDF} className="px-4 py-2 text-sm text-ink/70 hover:text-gold hover:bg-gold/10 rounded-xl transition-all flex items-center space-x-2">
                        <Download className="w-4 h-4" />
                        <span>Download PDF</span>
                    </button>
                    <div className="flex space-x-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-ink/60 hover:text-ink hover:bg-white/5 rounded-xl transition-all">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving || !title.trim()} className="px-5 py-2.5 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:scale-95 shadow-lg shadow-gold/20 disabled:opacity-50 flex items-center space-x-2">
                            <Save className="w-4 h-4" />
                            <span>{saving ? 'Saving...' : 'Save Note'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}