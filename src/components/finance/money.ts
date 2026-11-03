/** Naira with thousands separators and kobo: ₦12,500.50 */
export const naira = (n: number) =>
  `${n < 0 ? '-' : ''}₦${Math.abs(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** No kobo when the amount is whole, for headline figures: ₦12,500 */
export const nairaShort = (n: number) =>
  Number.isInteger(n) ? `${n < 0 ? '-' : ''}₦${Math.abs(n).toLocaleString('en-NG')}` : naira(n)

export const monthLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

/** One id per logical action, reused on a retry so the server can drop a double submit. */
export const newRequestId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

/** Call a finance endpoint and normalise the outcome: { ok, error } with the server's own plain-language reason. */
export async function api(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) return { ok: false, error: String(data.error || `Request failed (${res.status})`) }
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'No connection. Nothing was changed. Try again.' }
  }
}
