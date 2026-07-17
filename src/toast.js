const container = () => document.getElementById('toast-container')

let queue = []
let processing = false

export function showToast(message, type = 'info', action = null) {
  queue.push({ message, type, action })
  if (!processing) processNext()
}

function processNext() {
  if (queue.length === 0) {
    processing = false
    return
  }
  processing = true
  const { message, type, action } = queue.shift()

  const el = document.createElement('div')
  el.className = `toast toast-${type}`

  const msg = document.createElement('span')
  msg.textContent = message
  el.appendChild(msg)

  if (action) {
    const btn = document.createElement('button')
    btn.className = 'toast-action'
    btn.textContent = action.label
    btn.addEventListener('click', () => {
      action.fn()
      dismiss(el)
    })
    el.appendChild(btn)
  }

  const close = document.createElement('button')
  close.className = 'toast-close'
  close.textContent = '×'
  close.addEventListener('click', () => dismiss(el))
  el.appendChild(close)

  container().appendChild(el)

  const timer = setTimeout(() => dismiss(el), 5000)
  el._timer = timer
}

function dismiss(el) {
  clearTimeout(el._timer)
  el.classList.add('toast-exit')
  setTimeout(() => {
    el.remove()
    processNext()
  }, 300)
}
