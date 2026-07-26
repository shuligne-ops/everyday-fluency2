'use client'

import { useState } from 'react'
import { recoverAccess } from '@/lib/authRecovery'
import { track } from '@/lib/analytics'

export default function AuthRecoveryScreen() {
  const [recovering, setRecovering] = useState(false)

  async function handleRetry() {
    track('auth_retry_clicked')
    await new Promise((resolve) => setTimeout(resolve, 400))
    window.location.reload()
  }

  async function handleRecovery() {
    if (recovering) return
    setRecovering(true)
    await recoverAccess()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#fdf8f0' }}>
      <div style={{ width: '100%', maxWidth: '480px', padding: '32px 24px', background: 'white', border: '1px solid #f59e0b30', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: '#1a1a2e', marginBottom: '12px' }}>
          Не удалось загрузить урок
        </h1>
        <p style={{ color: '#666', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
          Обычно помогает кнопка ниже. Если не поможет — восстановите доступ, данные курса не пострадают, нужно будет войти заново.
        </p>
        <button
          type="button"
          onClick={handleRetry}
          style={{ width: '100%', padding: '14px 20px', border: 'none', borderRadius: '12px', background: '#f59e0b', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '15px', fontWeight: 700 }}
        >
          Попробовать ещё раз
        </button>
        <button
          type="button"
          onClick={handleRecovery}
          disabled={recovering}
          style={{ width: '100%', padding: '12px 20px', marginTop: '12px', border: '1px solid #ddd', borderRadius: '12px', background: 'transparent', color: '#666', cursor: recovering ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600, opacity: recovering ? 0.7 : 1 }}
        >
          {recovering ? 'Восстанавливаем...' : 'Восстановить доступ'}
        </button>
        <p style={{ color: '#999', fontSize: '12px', marginTop: '8px' }}>
          Придётся войти заново
        </p>
      </div>
    </div>
  )
}
