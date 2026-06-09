export function formatKES(amount) {
  const n = Math.round(Number(amount) || 0)
  return `${n.toLocaleString()} KES`
}
