export function scrollToHash(lenisRef, href) {
  const lenis = lenisRef?.current
  if (lenis) lenis.scrollTo(href, { offset: -88, duration: 1.2 })
  else document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
}
