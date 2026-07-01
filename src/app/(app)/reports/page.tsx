'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Download, FileText, BarChart3 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export default function ReportsPage() {
    const [reportType, setReportType] = useState<ReportType>('weekly')
    const [report, setReport] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const fetchReport = async () => {
        setLoading(true)
        try {
            const dateStr = new Date().toISOString()
            const res = await fetch(`/api/reports?type=${reportType}&date=${dateStr}`)
            if (res.ok) {
                const data = await res.json()
                setReport(data.report)
            } else {
                alert('Failed to load report')
            }
        } catch (e) {
            console.error(e)
            alert('Network error')
        } finally {
            setLoading(false)
        }
    }

    const downloadReport = () => {
        if (!report) return
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center space-x-3">
                <BarChart3 className="w-6 h-6 text-gold" />
                <div>
                    <h1 className="text-2xl font-display font-bold text-ink">Reports</h1>
                    <p className="text-xs text-ink/50">Download activity reports by period</p>
                </div>
            </div>

            <Card className="p-6">
                <div className="flex items-center space-x-4">
                    <select
                        value={reportType}
                        onChange={e => setReportType(e.target.value as ReportType)}
                        className="px-4 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30"
                    >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                    <button onClick={fetchReport} disabled={loading} className="px-4 py-2 bg-ink text-surface rounded-lg font-medium hover:bg-ink/90 transition disabled:opacity-50">
                        {loading ? 'Loading...' : 'Generate Report'}
                    </button>
                    {report && (
                        <button onClick={downloadReport} className="px-4 py-2 border border-mist rounded-lg text-sm font-medium hover:border-gold transition flex items-center space-x-2">
                            <Download className="w-4 h-4" />
                            <span>Download JSON</span>
                        </button>
                    )}
                </div>
            </Card>

            {report && (
                <Card className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-ink capitalize">{report.type} Report</h2>
                        <span className="text-xs text-ink/50 font-mono">
                            {format(parseISO(report.period.start), 'MMM d, yyyy')} - {format(parseISO(report.period.end), 'MMM d, yyyy')}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-paper border border-mist rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-ink">{report.stats.totalTasks}</p>
                            <p className="text-[10px] uppercase text-ink/50 font-bold">Total Tasks</p>
                        </div>
                        <div className="bg-paper border border-mist rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-sage">{report.stats.completedTasks}</p>
                            <p className="text-[10px] uppercase text-ink/50 font-bold">Completed</p>
                        </div>
                        <div className="bg-paper border border-mist rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-gold">{report.stats.totalNotes}</p>
                            <p className="text-[10px] uppercase text-ink/50 font-bold">Notes</p>
                        </div>
                        <div className="bg-paper border border-mist rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-ink">{report.stats.avgScore}%</p>
                            <p className="text-[10px] uppercase text-ink/50 font-bold">Avg Score</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase text-ink/50">Daily Breakdown</h3>
                        {report.days.map((day: any) => (
                            <div key={day.date} className="border border-mist rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-ink">{format(parseISO(day.date), 'EEEE, MMM d, yyyy')}</span>
                                    <span className="text-xs font-mono text-ink/50">{day.score}%</span>
                                </div>
                                <div className="space-y-1">
                                    {day.tasks.length === 0 && day.notes.length === 0 && (
                                        <p className="text-xs text-ink/40">No activity</p>
                                    )}
                                    {day.tasks.map((t: any) => (
                                        <div key={t.id} className="flex items-center space-x-2 text-xs">
                                            <span className={`w-2 h-2 rounded-full ${t.completed ? 'bg-sage' : 'bg-gold'}`} />
                                            <span className={t.completed ? 'line-through text-ink/50' : 'text-ink'}>{t.title}</span>
                                            <span className="text-ink/40 font-mono">{t.weight}%</span>
                                        </div>
                                    ))}
                                    {day.notes.map((n: any) => (
                                        <div key={n.id} className="flex items-center space-x-2 text-xs">
                                            <FileText className="w-3 h-3 text-gold" />
                                            <span className="text-ink">{n.title}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    )
}