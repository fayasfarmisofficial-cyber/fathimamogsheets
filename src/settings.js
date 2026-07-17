import { showToast } from './toast.js'

const API_KEY = 'voicesheet_api_key'

export function initSettings() {
  const modal = document.getElementById('settings-modal')
  const input = document.getElementById('api-key-input')
  const btnOpen = document.getElementById('btn-settings')
  const btnClose = document.getElementById('btn-settings-close')
  const btnSave = document.getElementById('btn-save-key')
  const btnClear = document.getElementById('btn-clear-key')
  const btnToggle = document.getElementById('btn-toggle-key')
  const bannerLink = document.getElementById('banner-settings-link')

  function open() {
    input.value = localStorage.getItem(API_KEY) ?? ''
    modal.classList.remove('hidden')
    input.focus()
  }

  function close() {
    modal.classList.add('hidden')
  }

  btnOpen.addEventListener('click', open)
  bannerLink.addEventListener('click', (e) => { e.preventDefault(); open() })
  btnClose.addEventListener('click', close)

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close()
  })

  btnToggle.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password'
  })

  btnSave.addEventListener('click', () => {
    const key = input.value.trim()
    if (key) {
      localStorage.setItem(API_KEY, key)
      checkApiBanner()
      close()
      showToast('API key saved', 'success')
    } else {
      showToast('Please enter a key', 'error')
    }
  })

  btnClear.addEventListener('click', () => {
    localStorage.removeItem(API_KEY)
    input.value = ''
    checkApiBanner()
    showToast('API key cleared', 'info')
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSave.click()
  })
}

export function checkApiBanner() {
  const banner = document.getElementById('api-banner')
  const hasKey = !!localStorage.getItem(API_KEY)
  banner.classList.toggle('hidden', hasKey)
}

export function getApiKey() {
  return localStorage.getItem(API_KEY) ?? ''
}

export function requireApiKey() {
  const key = getApiKey()
  if (!key) {
    showToast('No API key set. Add one in Settings.', 'error')
    document.getElementById('btn-settings').click()
    return false
  }
  return true
}
