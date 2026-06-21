// API 클라이언트.
// 배포: VITE_API_URL=https://backend.railway.app → fetch 가 해당 도메인으로
// 개발: VITE_API_URL 없음 → vite proxy(/api → localhost:8002) 경유
const BASE = import.meta.env.VITE_API_URL || ''

function getPasscode() {
  return localStorage.getItem('gm_passcode') || ''
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  const pc = getPasscode()
  if (pc) headers['X-Passcode'] = pc
  // FormData 는 Content-Type 을 브라우저가 boundary 포함해 설정하므로 직접 세팅 안 함
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BASE}/api${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('gm_passcode')
    window.dispatchEvent(new Event('gm:logout'))
    throw new Error('401')
  }
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

function get(path) { return apiFetch(path) }
function post(path, body) { return apiFetch(path, { method: 'POST', body: JSON.stringify(body) }) }
function del(path) { return apiFetch(path, { method: 'DELETE' }) }
function upload(path, formData) { return apiFetch(path, { method: 'POST', body: formData }) }

export const api = {
  portfolio:       (market) => get(`/portfolio?market=${market}`),
  vault:           (market) => get(`/vault?market=${market}`),
  survey:          (market) => get(`/survey?market=${market}`),
  refresh:         (market) => get(`/refresh?market=${market}`),
  level:           (sync = false) => get(`/level${sync ? '?sync=true' : ''}`),
  surveyThemes:    () => get('/survey/themes/available'),
  interpretTheme:  (text) => post('/survey/theme/interpret', { text }),
  setTheme:        (market, themes) => post(`/survey/theme?market=${market}`, { themes }),
  deleteTheme:     (market) => del(`/survey/theme?market=${market}`),
  exploreSearch:   (q, market) => get(`/explore/search?q=${encodeURIComponent(q)}&market=${market}`),
  exploreSimulate: (body) => post('/explore/simulate', body),
  news:            (market) => get(`/news?market=${market}`),
  newsForTicker:   (market, ticker) => get(`/news?market=${market}&ticker=${encodeURIComponent(ticker)}`),
  exploreStock:    (ticker, market) => get(`/explore/stock?ticker=${encodeURIComponent(ticker)}&market=${market}`),
  exploreFinancials: (ticker, market) => get(`/explore/stock/financials?ticker=${encodeURIComponent(ticker)}&market=${market}`),
  highlights:      (market) => get(`/highlights?market=${market}`),
  radar:           (market) => get(`/radar?market=${market}`),
  visitStreak:     () => get('/visit/streak'),
  upload,
}
