// 시장 변경 시 자동 재요청하는 작은 fetch 훅. {data, loading, error}.
import { useEffect, useState } from 'react'

export function useApi(fetcher, market) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetcher(market)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [fetcher, market])

  return { data, loading, error }
}
