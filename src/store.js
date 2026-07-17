const STORAGE_KEY = 'voicesheet_rows'

const SEED = [
  { roll: 1, student: 'Aarav',  marks: 78, sales: 52000 },
  { roll: 2, student: 'Diya',   marks: 35, sales: 48000 },
  { roll: 3, student: 'Kabir',  marks: 91, sales: 73000 },
  { roll: 4, student: 'Meera',  marks: 64, sales: 39000 },
  { roll: 5, student: 'Rohan',  marks: 28, sales: 61000 },
  { roll: 6, student: 'Sana',   marks: 85, sales: 55000 },
  { roll: 7, student: 'Vivaan', marks: 49, sales: 68000 },
  { roll: 8, student: 'Zara',   marks: 96, sales: 44000 },
]

let _rows = []
let _subscriber = null

export function subscribe(fn) {
  _subscriber = fn
}

function notify() {
  if (_subscriber) _subscriber()
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_rows))
}

function nextRoll() {
  return Math.max(0, ..._rows.map(r => r.roll)) + 1
}

export function load() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    _rows = SEED.map(r => ({ ...r }))
    persist()
  } else {
    try {
      _rows = JSON.parse(raw)
    } catch {
      _rows = SEED.map(r => ({ ...r }))
      persist()
    }
  }
}

export function getRows() {
  return _rows.map(r => ({ ...r }))
}

export function addRow(data) {
  const roll = data.roll != null ? Number(data.roll) : nextRoll()
  const row = {
    roll,
    student: String(data.student ?? ''),
    marks: Number(data.marks ?? 0),
    sales: Number(data.sales ?? 0),
  }
  _rows.push(row)
  persist()
  notify()
  return { ...row }
}

export function updateCell(roll, field, value) {
  const row = _rows.find(r => r.roll === roll)
  if (!row) return
  if (field === 'roll') row.roll = Number(value)
  else if (field === 'marks') row.marks = Number(value)
  else if (field === 'sales') row.sales = Number(value)
  else row[field] = String(value)
  persist()
  notify()
}

export function deleteRow(roll) {
  _rows = _rows.filter(r => r.roll !== roll)
  persist()
  notify()
}

export function sortRows(field, direction) {
  _rows.sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (typeof av === 'number' && typeof bv === 'number') {
      return direction === 'asc' ? av - bv : bv - av
    }
    const as = String(av).toLowerCase()
    const bs = String(bv).toLowerCase()
    const cmp = as < bs ? -1 : as > bs ? 1 : 0
    return direction === 'asc' ? cmp : -cmp
  })
  persist()
  notify()
}

export function findRowByIdentifier(identifier) {
  const str = String(identifier).trim()
  const asNum = Number(str)
  if (!isNaN(asNum) && str !== '') {
    return _rows.find(r => r.roll === asNum) ?? null
  }
  const lower = str.toLowerCase()
  return _rows.find(r => r.student.toLowerCase().includes(lower)) ?? null
}
