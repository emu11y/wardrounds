import * as XLSX from 'xlsx'
import { printHtml, escapeHtml } from './print'
import { formatDate } from './utils'

// ─────────────────────────────────────────────────────────────────────────────
// exportTable.js — one Excel + one PDF exporter for every list page (Billing,
// Shifts, …). Pages build ONE row-shape (array of flat objects) and hand it to
// both functions, so the two exports never drift apart.
//   rows    : [{ 'Column': value, … }]   (columns containing "KES" are number-formatted in the PDF)
//   filters : [['Label', 'Value'], …]    (Excel "Filters" sheet + PDF subtitle)
// ─────────────────────────────────────────────────────────────────────────────

export function exportRowsToExcel(rows, { sheetName, fileName, filters = [] }) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    ...filters.map(([Filter, Value]) => ({ Filter, Value })),
    { Filter: 'Rows', Value: rows.length },
    { Filter: 'Exported', Value: formatDate(new Date()) },
  ]), 'Filters')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

const PDF_CSS =
  'h1{font-size:16px;margin:0 0 2px;} .sub{font-size:11px;color:#666;margin:0 0 10px;}' +
  'table{width:100%;border-collapse:collapse;font-size:10px;}' +
  'th,td{border:1px solid #ddd;padding:5px 6px;text-align:left;vertical-align:top;}' +
  'th{background:#f3f4f6;font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:.03em;}' +
  'tfoot td{font-weight:700;background:#fafafa;}'

export function exportRowsToPdf(rows, { title, fileName, filters = [], unitLabel = 'row(s)', totals = null }) {
  const head = rows.length ? Object.keys(rows[0]) : []
  const cell = (h, v) => escapeHtml(h.includes('KES') && v !== '' && v != null ? Number(v).toLocaleString() : v)
  const bodyRows = rows.map(row => '<tr>' + head.map(h => `<td>${cell(h, row[h])}</td>`).join('') + '</tr>').join('')
  const foot = totals
    ? '<tfoot><tr>' + head.map(h => `<td>${totals[h] != null ? cell(h, totals[h]) : ''}</td>`).join('') + '</tr></tfoot>'
    : ''
  const sub = [...filters.map(([, v]) => v), `${rows.length} ${unitLabel}`, formatDate(new Date())]
    .map(escapeHtml).join(' · ')
  const body =
    `<h1>${escapeHtml(title)}</h1><p class="sub">${sub}</p>` +
    `<table><thead><tr>${head.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody>${foot}</table>`
  printHtml(body, { title: fileName, landscape: true, extraCss: PDF_CSS })
}
