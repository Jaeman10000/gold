// 광부 명함 바텀시트 — PNG 저장 + Web Share API + 링크 복사.
import { useState, useEffect, useRef } from 'react'
import { toPng } from 'html-to-image'
import { api } from '../api/client'
import MinerCard from './MinerCard'

export default function MinerCardSheet({ open, onClose, market }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api.card(market)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [open, market])

  if (!open) return null

  const captureCard = () => toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })

  const handleDownload = async () => {
    if (!cardRef.current || busy) return
    setBusy(true)
    try {
      const url = await captureCard()
      const a = document.createElement('a')
      a.download = `gwangmaek_lv${data?.level || 1}.png`
      a.href = url
      a.click()
    } catch (e) {
      console.error('PNG 저장 실패', e)
    } finally {
      setBusy(false)
    }
  }

  const handleShare = async () => {
    if (!cardRef.current || busy) return
    setBusy(true)
    try {
      const url = await captureCard()
      const blob = await (await fetch(url)).blob()
      const file = new File([blob], `gwangmaek_lv${data?.level || 1}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `광맥 Lv${data?.level} · ${data?.grade}등급`,
          text: '잠자는 동안 캐는 내 포트폴리오 금광 🏅',
        })
      } else {
        // Web Share API 미지원 → 다운로드로 폴백
        const a = document.createElement('a')
        a.download = `gwangmaek_lv${data?.level || 1}.png`
        a.href = url
        a.click()
      }
    } catch (e) {
      if (e?.name !== 'AbortError') console.error('공유 실패', e)
    } finally {
      setBusy(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 권한 없는 경우 무시
    }
  }

  return (
    <div className="card-sheet-backdrop" onClick={onClose}>
      <div className="card-sheet" onClick={e => e.stopPropagation()}>
        <div className="card-sheet-handle" />

        <div className="card-sheet-title">광부 명함</div>

        {loading ? (
          <div className="card-sheet-loading">명함 만드는 중…</div>
        ) : !data ? (
          <div className="card-sheet-err">데이터를 불러오지 못했어요</div>
        ) : (
          <>
            <div className="card-sheet-preview">
              <MinerCard cardRef={cardRef} data={data} />
            </div>

            <div className="card-sheet-actions">
              <button
                className="csa-btn csa-primary"
                onClick={handleShare}
                disabled={busy}
              >
                <span>📤</span> 공유
              </button>
              <button
                className="csa-btn"
                onClick={handleDownload}
                disabled={busy}
              >
                <span>💾</span> PNG 저장
              </button>
              <button
                className="csa-btn"
                onClick={handleCopyLink}
              >
                <span>{copied ? '✓' : '🔗'}</span> {copied ? '복사됨' : '링크 복사'}
              </button>
            </div>
          </>
        )}

        <button className="card-sheet-close" onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}
