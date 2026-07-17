import { transcribeAudio, extractRowFromTranscript } from './openai.js'
import { requireApiKey } from './settings.js'
import { showToast } from './toast.js'
import * as store from './store.js'

let mediaRecorder = null
let audioChunks = []
let stream = null

function getMimeType() {
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/ogg')) return 'audio/ogg'
  return ''
}

function setButtonState(btn, state) {
  btn.classList.remove('recording', 'processing')
  btn.disabled = false

  if (state === 'recording') {
    btn.classList.add('recording')
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> Stop`
  } else if (state === 'processing') {
    btn.classList.add('processing')
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Processing…`
    btn.disabled = true
  } else {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> Add by voice`
  }
}

function stopStream() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
}

export function initVoiceButton(btnId, { onSuccess, onTranscript } = {}) {
  const btn = document.getElementById(btnId)
  if (!btn) return

  btn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
      return
    }

    if (!requireApiKey()) return

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        showToast('Microphone access denied. Please allow mic access and try again.', 'error')
      } else {
        showToast('Could not access microphone: ' + e.message, 'error')
      }
      return
    }

    const mimeType = getMimeType()
    const options = mimeType ? { mimeType } : {}
    mediaRecorder = new MediaRecorder(stream, options)
    audioChunks = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      setButtonState(btn, 'processing')
      stopStream()

      const blobType = mimeType || 'audio/webm'
      const blob = new Blob(audioChunks, { type: blobType })
      audioChunks = []

      try {
        const transcript = await transcribeAudio(blob)
        if (onTranscript) onTranscript(transcript)

        const rowData = await extractRowFromTranscript(transcript)
        const newRow = store.addRow(rowData)

        showToast(`Added ${newRow.student} (roll ${newRow.roll})`, 'success', {
          label: 'Undo',
          fn: () => {
            store.deleteRow(newRow.roll)
            showToast('Undone', 'info')
          },
        })

        if (onSuccess) onSuccess(newRow, transcript)
      } catch (e) {
        showToast(e.message || 'Voice processing failed', 'error')
      }

      setButtonState(btn, 'idle')
      mediaRecorder = null
    }

    mediaRecorder.start()
    setButtonState(btn, 'recording')
  })
}

export async function recordAndTranscribe() {
  return new Promise((resolve, reject) => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
      stream = s
      const mimeType = getMimeType()
      const options = mimeType ? { mimeType } : {}
      const recorder = new MediaRecorder(s, options)
      const chunks = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = async () => {
        s.getTracks().forEach(t => t.stop())
        const blobType = mimeType || 'audio/webm'
        const blob = new Blob(chunks, { type: blobType })
        try {
          const text = await transcribeAudio(blob)
          resolve(text)
        } catch (e) {
          reject(e)
        }
      }

      recorder.start()

      // expose stop function via returned controller
      resolve._recorder = recorder
    }).catch(reject)
  })
}
