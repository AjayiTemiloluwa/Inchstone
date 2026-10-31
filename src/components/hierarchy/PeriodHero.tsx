'use client'

import { Download } from 'lucide-react'
import { Button, Panel, PageHeader } from '@/components/ds'
import { Breadcrumbs, type Crumb } from './Breadcrumbs'
import { ScoreInstrument } from './primitives'

interface PeriodHeroProps {
  title: string
  subtitle: string
  score: number
  onDownloadReport: () => void
  /** Mono kicker above the title, e.g. "Quarter". */
  eyebrow?: string
  /** Path back up the hierarchy, shown above the header. */
  crumbs?: Crumb[]
  /** Caption beside the score, e.g. "across 6 goals". */
  scoreCaption?: string
}

/** Header for the aggregated quarter / month / week pages: crumbs, title, report, work-clock read. */
export function PeriodHero({ title, subtitle, score, onDownloadReport, eyebrow, crumbs, scoreCaption }: PeriodHeroProps) {
  return (
    <div className="space-y-5 sm:space-y-6">
      {crumbs && <Breadcrumbs crumbs={crumbs} />}
      <PageHeader eyebrow={eyebrow} title={title} description={subtitle}
        actions={
          <Button icon={Download} onClick={onDownloadReport} aria-label="Download report">
            <span className="hidden sm:inline">Report</span>
          </Button>
        } />
      <Panel>
        <ScoreInstrument score={score} label="Average progress" caption={scoreCaption} />
      </Panel>
    </div>
  )
}
