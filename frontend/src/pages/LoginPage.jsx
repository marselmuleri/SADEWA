import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@sadewa.ac.id')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      setError('Username atau password salah')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-semibold text-primary mb-6">Login SADEWA</h1>
        {error && <p className="text-warning text-sm mb-3">{error}</p>}
        <input type="email" required className="w-full border rounded px-3 py-2 mb-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Username / Email" />
        <input type="password" minLength="6" required className="w-full border rounded px-3 py-2 mb-2" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button type="button" className="block text-xs text-primary mb-4">Lupa password?</button>
        <button className="w-full bg-primary text-white rounded px-4 py-2">Masuk</button>
      </form>
    </div>
  )
}
