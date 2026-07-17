import * as store from './store.js'
import { showToast } from './toast.js'

export function renderTable() {
  const tbody = document.getElementById('data-tbody')
  const emptyState = document.getElementById('empty-state')
  const rowCount = document.getElementById('row-count')
  const rows = store.getRows()

  tbody.innerHTML = ''

  if (rows.length === 0) {
    emptyState.classList.remove('hidden')
    rowCount.textContent = '0 rows'
    return
  }

  emptyState.classList.add('hidden')
  rowCount.textContent = `${rows.length} row${rows.length === 1 ? '' : 's'}`

  for (const row of rows) {
    tbody.appendChild(buildRow(row))
  }

  applyFormatting()
}

function buildRow(row) {
  const tr = document.createElement('tr')
  tr.dataset.roll = row.roll

  tr.appendChild(makeCell(row, 'roll', 'number'))
  tr.appendChild(makeCell(row, 'student', 'text'))
  tr.appendChild(makeCell(row, 'marks', 'number'))
  tr.appendChild(makeCell(row, 'sales', 'number'))

  const actionTd = document.createElement('td')
  actionTd.className = 'col-actions'
  const delBtn = document.createElement('button')
  delBtn.className = 'btn-delete'
  delBtn.title = 'Delete row'
  delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
  delBtn.addEventListener('click', () => {
    store.deleteRow(row.roll)
    showToast(`Deleted ${row.student || 'row'}`, 'info')
  })
  actionTd.appendChild(delBtn)
  tr.appendChild(actionTd)

  return tr
}

function makeCell(row, field, type) {
  const td = document.createElement('td')
  td.dataset.field = field
  td.textContent = row[field]
  td.contentEditable = 'true'
  td.spellcheck = false

  let originalValue = String(row[field])

  td.addEventListener('focus', () => {
    originalValue = td.textContent.trim()
    td.style.background = ''
  })

  td.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      td.blur()
    }
    if (e.key === 'Escape') {
      td.textContent = originalValue
      td.blur()
    }
  })

  td.addEventListener('blur', () => {
    const raw = td.textContent.trim()
    if (raw === originalValue) {
      applyFormatting()
      return
    }
    if (type === 'number') {
      const num = Number(raw)
      if (isNaN(num) || raw === '') {
        td.textContent = originalValue
        showToast('Must be a number', 'error')
        applyFormatting()
        return
      }
      if (field === 'marks' && (num < 0 || num > 100)) {
        td.textContent = originalValue
        showToast('Marks must be 0–100', 'error')
        applyFormatting()
        return
      }
      store.updateCell(row.roll, field, num)
      if (field === 'roll') row.roll = num
    } else {
      store.updateCell(row.roll, field, raw)
    }
  })

  return td
}

export function applyFormatting() {
  const rows = store.getRows()
  if (rows.length === 0) return

  const tbody = document.getElementById('data-tbody')
  const trs = tbody.querySelectorAll('tr')

  const marksValues = rows.map(r => r.marks).sort((a, b) => b - a)
  const topThreshold = marksValues.length >= 2 ? marksValues[1] : marksValues[0]

  const maxSales = Math.max(...rows.map(r => r.sales), 1)

  trs.forEach(tr => {
    const roll = Number(tr.dataset.roll)
    const row = rows.find(r => r.roll === roll)
    if (!row) return

    const cells = tr.querySelectorAll('td[data-field]')
    cells.forEach(td => {
      const field = td.dataset.field
      if (field === 'marks') {
        if (document.activeElement === td) return
        if (row.marks < 40) {
          td.style.background = 'var(--color-marks-low)'
        } else if (row.marks >= topThreshold) {
          td.style.background = 'var(--color-marks-top)'
        } else {
          td.style.background = ''
        }
      } else if (field === 'sales') {
        if (document.activeElement === td) return
        const pct = Math.round((row.sales / maxSales) * 100)
        td.style.background = `linear-gradient(to right, var(--color-sales-bar) ${pct}%, transparent ${pct}%)`
      }
    })
  })
}
