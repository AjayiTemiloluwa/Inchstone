import { format } from 'date-fns'
import type { Item } from '@/stores/hierarchyStore'

interface ReportOptions {
  /** e.g. "Quarter Report: Q1". */
  heading: string
  /** File name without the .pdf extension. */
  fileName: string
  categories: Item[]
  completionMap: Record<string, number>
}

/** One-page PDF summary of category progress for the aggregated period pages. */
export async function downloadCategoryReport({ heading, fileName, categories, completionMap }: ReportOptions) {
  const jsPDF = (await import('jspdf')).default
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let y = 20

  doc.setFontSize(18)
  doc.setTextColor(212, 175, 55)
  doc.setFont('helvetica', 'bold')
  doc.text(heading, margin, y)
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

  doc.setFontSize(12)
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'bold')
  doc.text('Categories & Goals', margin, y)
  y += 7

  categories.forEach(cat => {
    if (y > 270) { doc.addPage(); y = 20 }
    doc.setFontSize(10)
    doc.setTextColor(212, 175, 55)
    doc.setFont('helvetica', 'bold')
    doc.text(cat.title, margin, y)
    y += 5

    const catScore = completionMap[cat.id] || 0
    doc.setFontSize(8)
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'normal')
    doc.text(`• Overall progress: ${Math.round(catScore)}%`, margin + 4, y)
    doc.setTextColor(143, 188, 143)
    doc.text(`${Math.round(catScore)}%`, pageWidth - margin, y, { align: 'right' })
    y += 8
  })

  doc.setFontSize(7)
  doc.setTextColor(200, 200, 200)
  doc.setFont('helvetica', 'italic')
  doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy h:mm a')}`, margin, 285)

  doc.save(`${fileName}.pdf`)
}
