'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Download, FileText, BarChart3 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import jsPDF from 'jspdf'

type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

interface ReportDay {
    date: string
    tasks: any[]
    notes: any[]
    score: number
}

interface Report {
    type: ReportType
    period: { start: string; end: string }
    days: ReportDay[]
    stats: {
        totalTasks: number
        completedTasks: number
        totalNotes: number
        avgScore: number
    }
}

export default function ReportsPage() {
    const [reportType, setReportType] = useState<ReportType>('weekly')
    const [report, setReport] = useState<Report | null>(null)
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

    const downloadPDF = () => {
        if (!report) return

        const doc = new jsPDF('p', 'mm', 'a4')
        const pageWidth = doc.internal.pageSize.getWidth()
        const margin = 20
        const contentWidth = pageWidth - margin * 2
        let y = 20

        // Colors matching the app theme
        const gold: [number, number, number] = [212, 175, 55]
        const ink: [number, number, number] = [30, 30, 30]
        const sage: [number, number, number] = [143, 188, 143]
        const mist: [number, number, number] = [200, 200, 200]

        // Helper functions
        const addSectionTitle = (title: string) => {
            doc.setFontSize(14)
            doc.setTextColor(...ink)
            doc.setFont('helvetica', 'bold')
            doc.text(title, margin, y)
            y += 8
        }

        const addDivider = () => {
            doc.setDrawColor(...mist)
            doc.setLineWidth(0.3)
            doc.line(margin, y, pageWidth - margin, y)
            y += 6
        }

        // Title
        doc.setFontSize(22)
        doc.setTextColor(...gold)
        doc.setFont('helvetica', 'bold')
        doc.text('Inchstone Report', margin, y)
        y += 10

        doc.setFontSize(11)
        doc.setTextColor(...ink)
        doc.setFont('helvetica', 'normal')
        doc.text(`Period: ${format(parseISO(report.period.start), 'MMM d, yyyy')} - ${format(parseISO(report.period.end), 'MMM d, yyyy')}`, margin, y)
        y += 6
        doc.text(`Type: ${report.type.charAt(0).toUpperCase() + report.type.slice(1)}`, margin, y)
        y += 12

        // Stats Overview
        addSectionTitle('Overview')
        type ColorTriple = [number, number, number]

        const stats: { label: string; value: string; color: ColorTriple }[] = [
            { label: 'Total Tasks', value: report.stats.totalTasks.toString(), color: ink },
            { label: 'Completed', value: report.stats.completedTasks.toString(), color: sage },
            { label: 'Notes', value: report.stats.totalNotes.toString(), color: gold },
            { label: 'Avg Score', value: `${report.stats.avgScore}%`, color: ink },
        ]

        const statBoxWidth = contentWidth / stats.length - 2
        stats.forEach((stat, i) => {
            const x = margin + i * (statBoxWidth + 3)
            doc.setDrawColor(...mist)
            doc.setLineWidth(0.3)
            doc.roundedRect(x, y - 4, statBoxWidth, 20, 2, 2, 'S')
            doc.setFontSize(16)
            doc.setTextColor(...stat.color)
            doc.setFont('helvetica', 'bold')
            doc.text(stat.value, x + statBoxWidth / 2, y + 8, { align: 'center' })
            doc.setFontSize(7)
            doc.setTextColor(...ink)
            doc.setFont('helvetica', 'normal')
            doc.text(stat.label.toUpperCase(), x + statBoxWidth / 2, y + 14, { align: 'center' })
        })
        y += 28

        // Daily Breakdown
        addDivider()
        addSectionTitle('Daily Breakdown')

        report.days.forEach((day, index) => {
            // Check page break
            if (y > 260) {
                doc.addPage()
                y = 20
            }

            // Day header
            doc.setFontSize(10)
            doc.setTextColor(...ink)
            doc.setFont('helvetica', 'bold')
            const dayLabel = format(parseISO(day.date), 'EEEE, MMM d, yyyy')
            doc.text(dayLabel, margin, y)

            doc.setFontSize(9)
            doc.setTextColor(...sage)
            doc.setFont('helvetica', 'normal')
            doc.text(`${day.score}%`, pageWidth - margin, y, { align: 'right' })
            y += 5

            // Day underline
            doc.setDrawColor(...mist)
            doc.setLineWidth(0.2)
            doc.line(margin, y, pageWidth - margin, y)
            y += 4

            // Tasks
            if (day.tasks.length === 0 && day.notes.length === 0) {
                doc.setFontSize(8)
                doc.setTextColor(...mist)
                doc.setFont('helvetica', 'italic')
                doc.text('No activity', margin + 3, y)
                y += 5
            } else {
                day.tasks.forEach((task) => {
                    if (y > 275) {
                        doc.addPage()
                        y = 20
                    }
                    const bullet = task.completed ? '✓' : '○'
                    doc.setFontSize(8)
                    doc.setTextColor(...(task.completed ? sage : gold))
                    doc.setFont('helvetica', 'normal')
                    doc.text(bullet, margin + 2, y)
                    doc.setTextColor(...(task.completed ? mist : ink))
                    doc.text(task.title || '', margin + 8, y)
                    if (task.weight) {
                        doc.text(`${task.weight}%`, pageWidth - margin, y, { align: 'right' })
                    }
                    y += 4
                })

                day.notes.forEach((note) => {
                    if (y > 275) {
                        doc.addPage()
                        y = 20
                    }
                    doc.setFontSize(8)
                    doc.setTextColor(...gold)
                    doc.setFont('helvetica', 'normal')
                    doc.text('📝', margin + 2, y)
                    doc.setTextColor(...ink)
                    doc.text(note.title || '', margin + 8, y)
                    y += 4
                })
            }

            y += 3
        })

        // Footer
        y = 285
        doc.setFontSize(7)
        doc.setTextColor(...mist)
        doc.setFont('helvetica', 'italic')
        doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy h:mm a')}`, margin, y)

        doc.save(`${report.type}-report-${new Date().toISOString().split('T')[0]}.pdf`)
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
                        <button onClick={downloadPDF} className="px-4 py-2 border border-mist rounded-lg text-sm font-medium hover:border-gold transition flex items-center space-x-2">
                            <Download className="w-4 h-4" />
                            <span>Download PDF</span>
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
                        {report.days.map((day: ReportDay) => (
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