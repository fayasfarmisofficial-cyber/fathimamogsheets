import * as store from './store.js'

export function exportCSV() {
  const rows = store.getRows()
  const header = 'Roll,Student,Marks,Sales'
  const lines = rows.map(r => {
    const student = `"${String(r.student).replace(/"/g, '""')}"`
    return `${r.roll},${student},${r.marks},${r.sales}`
  })
  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'fathimamog-export.csv'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
