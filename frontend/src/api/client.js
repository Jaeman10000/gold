// API 래퍼 — baseURL 은 vite proxy(/api → :8002) 를 통해 한 곳에서 관리.
async function get(path) {
  const res = await fetch(`/api${path}`)
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

export const api = {
  portfolio: (market) => get(`/portfolio?market=${market}`),
  vault: (market) => get(`/vault?market=${market}`),
  survey: (market) => get(`/survey?market=${market}`),
}
