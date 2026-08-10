// Reusable "Save as PDF" via the browser print dialog. Renders arbitrary HTML in an
// off-screen iframe (the only element on its own page) and prints it — the same
// isolate-in-an-iframe technique InvoiceModal uses, so app wrappers never clip or
// resize the output. The temporary document.title swap makes the saved PDF's default
// filename meaningful. Kept generic (caller supplies bodyHtml + optional head CSS) so
// any page can export a clean printable without re-implementing the plumbing.
export function printHtml(bodyHtml, { title = 'Export', extraCss = '', landscape = false } = {}) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1123px;height:794px;border:0;'
  document.body.appendChild(iframe)

  const idoc = iframe.contentDocument || iframe.contentWindow.document
  idoc.open()
  idoc.write(
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>' +
      `@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:12mm;}` +
      'html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;' +
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;}" +
      extraCss +
    '</style></head><body>' + bodyHtml + '</body></html>'
  )
  idoc.close()

  let done = false
  const doPrint = () => {
    if (done) return
    done = true
    const prevTitle = document.title
    document.title = title
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
    setTimeout(() => { document.title = prevTitle; iframe.remove() }, 1000)
  }

  const imgs = Array.from(idoc.images || [])
  let pending = imgs.filter(im => !im.complete).length
  if (pending > 0) {
    const tick = () => { if (--pending <= 0) doPrint() }
    imgs.forEach(im => { if (!im.complete) { im.onload = tick; im.onerror = tick } })
    setTimeout(doPrint, 1500)
  } else {
    setTimeout(doPrint, 200)
  }
}

// Minimal HTML-escape for values interpolated into printHtml table cells.
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
