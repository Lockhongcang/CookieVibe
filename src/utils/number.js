export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback

  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
