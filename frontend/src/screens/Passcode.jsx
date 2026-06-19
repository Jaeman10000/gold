// 패스코드 입력 화면 — APP_PASSCODE 설정 시 앱 진입 전 1회 표시.
import { useState } from 'react'

const BASE = import.meta.env.VITE_API_URL || ''

export default function Passcode({ onAuth }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleVerify(e) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${BASE}/api/auth/check`, {
        headers: { 'X-Passcode': input.trim() },
      })
      if (res.ok) {
        localStorage.setItem('gm_passcode', input.trim())
        onAuth()
      } else {
        setError('패스코드가 맞지 않아요')
        setInput('')
      }
    } catch {
      setError('서버에 연결할 수 없어요')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="passcode-screen">
      <div className="passcode-card">
        <div className="passcode-icon">⛏️</div>
        <h2 className="passcode-title">광맥</h2>
        <p className="passcode-sub">패스코드를 입력하세요</p>
        <form onSubmit={handleVerify} className="passcode-form">
          <input
            className="passcode-input"
            type="password"
            inputMode="numeric"
            placeholder="패스코드"
            value={input}
            onChange={e => { setInput(e.target.value); setError('') }}
            autoFocus
            disabled={loading}
          />
          {error && <p className="passcode-error">{error}</p>}
          <button className="passcode-btn" type="submit" disabled={loading || !input.trim()}>
            {loading ? '확인 중…' : '입장'}
          </button>
        </form>
      </div>
    </div>
  )
}
