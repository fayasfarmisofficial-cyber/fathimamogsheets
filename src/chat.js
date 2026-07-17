import * as store from './store.js'
import { sendChatMessage, transcribeAudio } from './openai.js'
import { requireApiKey } from './settings.js'
import { showToast } from './toast.js'

let history = []
let chatMicRecorder = null
let chatMicStream = null

export function initChat() {
  const panel = document.getElementById('chat-panel')
  const input = document.getElementById('chat-input')
  const sendBtn = document.getElementById('chat-send')
  const micBtn = document.getElementById('chat-mic')
  const closeBtn = document.getElementById('btn-chat-close')
  const toggleBtn = document.getElementById('btn-chat-toggle')

  toggleBtn.addEventListener('click', () => toggleChat())
  closeBtn.addEventListener('click', () => toggleChat(false))

  sendBtn.addEventListener('click', () => {
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    handleSend(text)
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendBtn.click()
    }
  })

  micBtn.addEventListener('click', () => handleChatMic(micBtn))
}

export function toggleChat(forceOpen) {
  const panel = document.getElementById('chat-panel')
  const tablePanel = document.getElementById('table-panel')
  const isOpen = panel.classList.contains('open')
  const shouldOpen = forceOpen !== undefined ? forceOpen : !isOpen

  panel.classList.toggle('open', shouldOpen)
  panel.classList.toggle('hidden', !shouldOpen)

  if (window.innerWidth <= 768) {
    tablePanel.classList.toggle('chat-open', shouldOpen)
  }

  if (shouldOpen) {
    const input = document.getElementById('chat-input')
    setTimeout(() => input.focus(), 300)
  }
}

async function handleSend(text) {
  if (!requireApiKey()) return

  appendMessage('user', text)
  history.push({ role: 'user', content: text })

  const typingEl = appendTyping()

  try {
    const result = await sendChatMessage({
      userMessage: text,
      history: history.slice(0, -1),
      tableData: store.getRows(),
    })

    typingEl.remove()

    if (result.type === 'function_call') {
      const reply = await dispatch(result.name, result.args)
      appendMessage('assistant', reply)
      history.push({ role: 'assistant', content: reply })
    } else {
      appendMessage('assistant', result.content)
      history.push({ role: 'assistant', content: result.content })
    }
  } catch (e) {
    typingEl.remove()
    const errMsg = 'Error: ' + (e.message || 'Something went wrong')
    appendMessage('assistant', errMsg)
    showToast(e.message || 'Chat error', 'error')
  }

  if (history.length > 20) history = history.slice(-20)
}

async function dispatch(name, args) {
  switch (name) {
    case 'add_row': {
      const newRow = store.addRow({
        student: args.student,
        marks: Number(args.marks),
        sales: Number(args.sales),
      })
      showToast(`Added ${newRow.student} (roll ${newRow.roll})`, 'success', {
        label: 'Undo',
        fn: () => {
          store.deleteRow(newRow.roll)
          showToast('Undone', 'info')
        },
      })
      return `Added ${newRow.student} — roll ${newRow.roll}, marks ${newRow.marks}, sales ₹${newRow.sales.toLocaleString()}.`
    }

    case 'edit_row': {
      const row = store.findRowByIdentifier(args.identifier)
      if (!row) return `Could not find student "${args.identifier}".`
      const field = args.field
      const value = field === 'student' ? args.value : Number(args.value)
      store.updateCell(row.roll, field, value)
      return `Updated ${row.student}'s ${field} to ${args.value}.`
    }

    case 'delete_row': {
      const row = store.findRowByIdentifier(args.identifier)
      if (!row) return `Could not find student "${args.identifier}".`
      store.deleteRow(row.roll)
      showToast(`Deleted ${row.student}`, 'info')
      return `Deleted ${row.student} (roll ${row.roll}).`
    }

    case 'sort_rows': {
      store.sortRows(args.field, args.direction)
      const dir = args.direction === 'asc' ? 'ascending' : 'descending'
      return `Sorted table by ${args.field} (${dir}).`
    }

    case 'answer_query': {
      return args.answer
    }

    default:
      return `Unknown action: ${name}.`
  }
}

function appendMessage(role, text) {
  const messages = document.getElementById('chat-messages')
  const div = document.createElement('div')
  div.className = `chat-message ${role}`
  div.textContent = text
  messages.appendChild(div)
  messages.scrollTop = messages.scrollHeight
  return div
}

function appendTyping() {
  const messages = document.getElementById('chat-messages')
  const div = document.createElement('div')
  div.className = 'chat-message assistant typing'
  div.innerHTML = '<span></span><span></span><span></span>'
  messages.appendChild(div)
  messages.scrollTop = messages.scrollHeight
  return div
}

function getMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/ogg')) return 'audio/ogg'
  return ''
}

async function handleChatMic(btn) {
  if (!requireApiKey()) return

  if (chatMicRecorder && chatMicRecorder.state === 'recording') {
    chatMicRecorder.stop()
    return
  }

  try {
    chatMicStream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (e) {
    showToast('Microphone access denied', 'error')
    return
  }

  const mimeType = getMimeType()
  const options = mimeType ? { mimeType } : {}
  chatMicRecorder = new MediaRecorder(chatMicStream, options)
  const chunks = []

  chatMicRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  chatMicRecorder.onstop = async () => {
    chatMicStream.getTracks().forEach(t => t.stop())
    btn.classList.remove('recording')
    btn.disabled = true

    const blobType = mimeType || 'audio/webm'
    const blob = new Blob(chunks, { type: blobType })

    try {
      const text = await transcribeAudio(blob)
      const input = document.getElementById('chat-input')
      input.value = text
      input.focus()
    } catch (e) {
      showToast('Transcription failed: ' + e.message, 'error')
    } finally {
      btn.disabled = false
      chatMicRecorder = null
    }
  }

  chatMicRecorder.start()
  btn.classList.add('recording')
}
