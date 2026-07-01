'use client'

import { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { X, Download, Save } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

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
    const [error, setError] = useState<string | null>(null)

    const editor = useEditor({
        extensions: [StarterKit],
        content: note?.content || '<p>Start writing your note...</p>',
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

    const handleSave = async () => {
        if (!title.trim()) return
        setSaving(true)
        setError(null)
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
            } else {
                setError('Failed to save note. Please try again.')
            }
        } catch (err) {
            setError('Network error. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    const handleDownloadPDF = async () => {
        if (!editor) return
        const element = editor.view.dom
        element.style.padding = '20px'
        element.style.background = 'white'

        try {
            const canvas = await html2canvas(element, {
                background: '#ffffff',
            } as any)
            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF('p', 'mm', 'a4')
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
            pdf.save(`${title || 'note'}.pdf`)
        } catch (err) {
            console.error('PDF export failed:', err)
            alert('Failed to export PDF')
        } finally {
            element.style.padding = ''
            element.style.background = ''
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
            <div className="bg-paper w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-mist">
                    <h3 className="font-bold text-ink">{note?.id ? 'Edit Note' : 'New Note'}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-mist rounded-full transition-colors">
                        <X className="w-5 h-5 text-ink/60" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className="text-xs font-bold text-ink/70 mb-1 block">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full rounded-lg border border-mist p-2.5 text-sm bg-surface"
                            placeholder="Note title..."
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-ink/70 mb-1 block">Link to Date (optional)</label>
                        <input
                            type="date"
                            value={itemId ? '' : defaultDate || ''}
                            onChange={e => setItemId(e.target.value)}
                            className="w-full rounded-lg border border-mist p-2.5 text-sm bg-surface"
                            placeholder="Link to day"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-ink/70 mb-1 block">Content</label>
                        <div className="border border-mist rounded-lg bg-surface">
                            {editor && (
                                <div className="flex items-center space-x-1 px-2 py-1 border-b border-mist">
                                    <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1 rounded hover:bg-mist ${editor.isActive('bold') ? 'bg-mist' : ''}`}>
                                        <span className="text-xs font-bold">B</span>
                                    </button>
                                    <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1 rounded hover:bg-mist ${editor.isActive('italic') ? 'bg-mist' : ''}`}>
                                        <span className="text-xs italic">I</span>
                                    </button>
                                    <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1 rounded hover:bg-mist ${editor.isActive('bulletList') ? 'bg-mist' : ''}`}>
                                        <span className="text-xs">• List</span>
                                    </button>
                                    <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1 rounded hover:bg-mist ${editor.isActive('heading', { level: 2 }) ? 'bg-mist' : ''}`}>
                                        <span className="text-xs font-bold">H</span>
                                    </button>
                                </div>
                            )}
                            <EditorContent editor={editor} />
                        </div>
                    </div>

                    {error && <p className="text-xs text-coral">{error}</p>}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-6 py-4 border-t border-mist">
                    <button onClick={handleDownloadPDF} className="px-4 py-2 text-sm text-ink/70 hover:text-ink transition flex items-center space-x-2">
                        <Download className="w-4 h-4" />
                        <span>Download PDF</span>
                    </button>
                    <div className="flex space-x-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-ink/70 hover:text-ink transition">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving || !title.trim()} className="px-4 py-2 text-sm bg-ink text-surface rounded-lg font-medium hover:bg-ink/90 transition disabled:opacity-50 flex items-center space-x-2">
                            <Save className="w-4 h-4" />
                            <span>{saving ? 'Saving...' : 'Save Note'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}