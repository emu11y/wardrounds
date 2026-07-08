export const darken = (hex, amt = 45) => {
  const n = parseInt(hex.replace('#', ''), 16)
  let r = (n >> 16) - amt, g = ((n >> 8) & 0xff) - amt, b = (n & 0xff) - amt
  return '#' + [Math.max(0, r), Math.max(0, g), Math.max(0, b)]
    .map(v => v.toString(16).padStart(2, '0')).join('')
}
