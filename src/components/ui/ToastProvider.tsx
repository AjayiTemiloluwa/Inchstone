'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
    id: string
    message: string
    type: ToastType
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void
    confirm: (message: string) => Promise<boolean>
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) throw new Error('useToast must be used within ToastProvider')
    return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])
    const [confirmState, setConfirmState] = useState<{ message: string, resolve: (val: boolean) => void } | null>(null)

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9)
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 3000)
    }, [])

    const confirm = useCallback((message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmState({ message, resolve })
        })
    }, [])

    const handleConfirmClose = (result: boolean) => {
        if (confirmState) {
            confirmState.resolve(result)
            setConfirmState(null)
        }
    }

    return (
        <ToastContext.Provider value={{ showToast, confirm }}>
            {children}

            {/* Toasts overlay */}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col space-y-3 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`pointer-events-auto flex items-center justify-between p-4 min-w-[250px] rounded-2xl shadow-xl shadow-black/20 border backdrop-blur-xl animate-slideUp ${t.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-100' : t.type === 'success' ? 'bg-sage/20 border-sage/30 text-sage-100' : 'bg-black/40 border-white/10 text-white'}`}>
                        <span className="text-sm font-bold">{t.message}</span>
                        <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Confirm Modal */}
            {confirmState && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="glass rounded-3xl border border-white/10 p-6 max-w-sm w-full mx-4 shadow-2xl animate-slideUp">
                        <h3 className="text-xl font-display font-bold text-ink mb-2">Are you sure?</h3>
                        <p className="text-sm text-ink/70 mb-6">{confirmState.message}</p>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => handleConfirmClose(false)} className="px-4 py-2 text-sm font-bold text-ink/60 hover:text-ink hover:bg-white/5 rounded-xl transition-all">Cancel</button>
                            <button onClick={() => handleConfirmClose(true)} className="px-4 py-2 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow transition-all shadow-lg shadow-gold/20">Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </ToastContext.Provider>
    )
}
