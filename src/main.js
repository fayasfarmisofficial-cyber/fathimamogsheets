import * as store from './store.js'
import { renderTable } from './table.js'
import { initChat, toggleChat } from './chat.js'
import { initVoiceButton } from './voice.js'
import { initSettings, checkApiBanner } from './settings.js'
import { exportCSV } from './export.js'
import { showToast } from './toast.js'

store.subscribe(() => renderTable())

document.addEventListener('DOMContentLoaded', () => {
  store.load()
  renderTable()
  initChat()
  initSettings()
  checkApiBanner()

  document.getElementById('btn-add-row').addEventListener('click', () => {
    const rows = store.getRows()
    store.addRow({
      student: '',
      marks: 0,
      sales: 0,
    })
    showToast('New row added', 'info')
    setTimeout(() => {
      const tbody = document.getElementById('data-tbody')
      const lastRow = tbody.lastElementChild
      if (lastRow) {
        const studentCell = lastRow.querySelector('td[data-field="student"]')
        if (studentCell) studentCell.focus()
      }
    }, 50)
  })

  document.getElementById('btn-export').addEventListener('click', () => {
    exportCSV()
    showToast('Exported to CSV', 'success')
  })

  initVoiceButton('btn-voice')
})
