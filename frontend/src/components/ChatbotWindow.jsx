import { useState } from 'react'
import api from '../services/api'

export default function ChatbotWindow() {
  const [messages, setMessages] = useState([])
  const [pertanyaan, setPertanyaan] = useState('')
  const [loading, setLoading] = useState(false)

  const kirim = async () => {
    if (!pertanyaan.trim()) return
    setMessages((prev) => [...prev, { role: 'user', text: pertanyaan }])
    setLoading(true)
    try {
      const { data } = await api.post('/chatbot/tanya', { pertanyaan })
      setMessages((prev) => [...prev, { role: 'assistant', text: data.respons }])
    } finally {
      setLoading(false)
      setPertanyaan('')
    }
  }

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
      <div className="h-80 overflow-y-auto space-y-2 mb-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={`p-2 rounded max-w-[80%] ${msg.role === 'user' ? 'ml-auto bg-primary text-white' : 'bg-slate-100'}`}>
            {msg.text}
          </div>
        ))}
        {loading && <div className="text-sm text-slate-500">SADEWA AI sedang mengetik...</div>}
      </div>
      <div className="flex gap-2">
        <input value={pertanyaan} onChange={(e) => setPertanyaan(e.target.value)} className="flex-1 border rounded px-3 py-2" placeholder="Tanya analisis OBE..." />
        <button onClick={kirim} className="bg-primary text-white px-4 rounded">Kirim</button>
      </div>
    </div>
  )
}
