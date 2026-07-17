import { getApiKey } from './settings.js'

const BASE = 'https://api.openai.com/v1'

function headers() {
  return {
    'Authorization': `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  }
}

export async function transcribeAudio(blob) {
  const fd = new FormData()
  const ext = blob.type.includes('ogg') ? 'audio.ogg' : 'audio.webm'
  fd.append('file', blob, ext)
  fd.append('model', 'whisper-1')

  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getApiKey()}` },
    body: fd,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Whisper error ${res.status}`)
  }
  const data = await res.json()
  return data.text ?? ''
}

function stripFences(raw) {
  return raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

export async function extractRowFromTranscript(transcript) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a data extraction assistant. Extract student data from a speech transcript.
Return ONLY a valid JSON object with these fields (omit any not mentioned):
{"student":"<full name>","marks":<integer 0-100>,"sales":<positive integer>}
No markdown, no explanation, no extra keys. Just the JSON object.`,
        },
        { role: 'user', content: transcript },
      ],
      temperature: 0,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `API error ${res.status}`)
  }
  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content ?? ''
  const parsed = JSON.parse(stripFences(raw))
  if (!parsed.student) throw new Error('Could not extract student name from transcript')
  return {
    student: String(parsed.student),
    marks: parsed.marks != null ? Number(parsed.marks) : 0,
    sales: parsed.sales != null ? Number(parsed.sales) : 0,
  }
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_row',
      description: 'Add a new student row to the table',
      parameters: {
        type: 'object',
        properties: {
          student: { type: 'string', description: 'Full name of the student' },
          marks:   { type: 'number', description: 'Marks scored (0–100)' },
          sales:   { type: 'number', description: 'Sales value (positive number)' },
        },
        required: ['student', 'marks', 'sales'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_row',
      description: 'Edit a field in an existing student row. Identify by student name or roll number.',
      parameters: {
        type: 'object',
        properties: {
          identifier: { type: 'string', description: 'Student name or roll number as a string' },
          field:      { type: 'string', enum: ['student', 'marks', 'sales'], description: 'Which field to change' },
          value:      { type: 'string', description: 'New value for the field' },
        },
        required: ['identifier', 'field', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_row',
      description: 'Delete a student row from the table. Identify by student name or roll number.',
      parameters: {
        type: 'object',
        properties: {
          identifier: { type: 'string', description: 'Student name or roll number as a string' },
        },
        required: ['identifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sort_rows',
      description: 'Sort the table rows by a specific field',
      parameters: {
        type: 'object',
        properties: {
          field:     { type: 'string', enum: ['roll', 'student', 'marks', 'sales'] },
          direction: { type: 'string', enum: ['asc', 'desc'] },
        },
        required: ['field', 'direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'answer_query',
      description: 'Answer a question or analysis request about the table data',
      parameters: {
        type: 'object',
        properties: {
          answer: { type: 'string', description: 'The answer to display to the user' },
        },
        required: ['answer'],
      },
    },
  },
]

export async function sendChatMessage({ userMessage, history, tableData }) {
  const systemPrompt = `You are an AI assistant for "Fathima Mog Sheet", a student data table app.
You help the user manage and analyze student records.

Current table data (JSON):
${JSON.stringify(tableData, null, 2)}

Rules:
- Always call exactly one function per response.
- For questions, calculations, or analysis (no data change), use answer_query.
- For data mutations, use the appropriate function.
- Student identifiers are case-insensitive; match by name or roll number.
- Marks must be 0–100. Sales must be positive numbers.
- Be concise and friendly in answer_query responses.`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10),
    { role: 'user', content: userMessage },
  ]

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `API error ${res.status}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]?.message

  if (choice?.tool_calls?.length) {
    const call = choice.tool_calls[0]
    const name = call.function.name
    const args = JSON.parse(call.function.arguments)
    return { type: 'function_call', name, args }
  }

  return { type: 'text', content: choice?.content ?? '(no response)' }
}
