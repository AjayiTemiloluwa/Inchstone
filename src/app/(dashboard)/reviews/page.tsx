'use client'

import { Card } from '@/components/ui/Card'
import { ReviewModal } from '@/components/ui/ReviewModal'
import { useState, useEffect } from 'react'

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchReviews = () => {
    setLoading(true)
    fetch('/api/reviews')
      .then(r => r.json())
      .then(data => setReviews(data.reviews || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchReviews()
  }, [])

  return (
    <div className="max-w-[720px] mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-parchment">Periodic Reviews</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-ink hover:bg-[#cbaa6f] transition-colors"
        >
          New Review
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <p className="py-10 text-center font-mono text-sm text-parchment/40">Loading…</p>
        ) : reviews.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-gold-dim/30 py-12 text-center">
            <p className="text-sm text-parchment/60">
              Nothing reviewed yet — a short honest review is a good place to start.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-sm font-medium text-gold hover:text-gold/80 transition-colors"
            >
              Write your first review
            </button>
          </div>
        ) : (
          reviews.map(review => (
            <Card key={review.id} className="hover:border-gold/40 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-parchment">
                    {review.periodType} Review
                  </h3>
                  <p className="mt-0.5 font-mono text-xs text-parchment/50">
                    {new Date(review.periodStart).toLocaleDateString()}
                  </p>
                </div>
                <div className="whitespace-nowrap font-mono text-xs text-parchment/60 tabular-nums">
                  <span>mood {review.mood} / 4</span>
                  <span className="text-gold-dim"> · </span>
                  <span>energy {review.energy} / 10</span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-parchment/80">{review.reflection}</p>
              {review.wins && (
                <div className="mt-3 border-l-2 border-moss pl-3">
                  <p className="font-mono text-xs uppercase tracking-wider text-parchment/50">Wins</p>
                  <p className="mt-1 text-sm text-parchment/70">{review.wins}</p>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {showModal && (
        <ReviewModal
          onClose={() => setShowModal(false)}
          onSaved={fetchReviews}
        />
      )}
    </div>
  )
}