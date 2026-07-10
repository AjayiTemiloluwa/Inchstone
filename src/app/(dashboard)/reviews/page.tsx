'use client'

import { Card } from '@/components/ui/Card'
import { ReviewModal } from '@/components/ui/ReviewModal'
import { useState, useEffect } from 'react'

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)

  const fetchReviews = () => {
    fetch('/api/reviews').then(r => r.json()).then(data => setReviews(data.reviews || []))
  }

  useEffect(() => {
    fetchReviews()
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-display font-bold text-ink">Periodic Reviews</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-ink text-surface rounded hover:bg-ink/90 font-medium"
        >
          New Review
        </button>
      </div>
      
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <p className="text-ink/60 p-4 border border-dashed border-mist rounded text-center">No reviews yet.</p>
        ) : (
          reviews.map(review => (
            <Card key={review.id} className="hover:border-gold cursor-pointer transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-ink uppercase tracking-wider text-sm">{review.periodType} Review</h3>
                  <p className="text-xs text-ink/50">{new Date(review.periodStart).toLocaleDateString()}</p>
                </div>
                <div className="flex space-x-2">
                  <span className="px-2 py-1 bg-sage/20 text-sage rounded text-xs font-bold">Mood: {review.mood}/4</span>
                  <span className="px-2 py-1 bg-gold/20 text-gold rounded text-xs font-bold">Energy: {review.energy}/10</span>
                </div>
              </div>
              <p className="text-sm text-ink/80">{review.reflection}</p>
              {review.wins && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-sage">Wins</p>
                  <p className="text-sm text-ink/70">{review.wins}</p>
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
