export function errMsg(e: unknown, fallback = 'Something went wrong'): string {
  return e instanceof Error && e.message ? e.message : fallback
}