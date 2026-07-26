'use client'

import { useState } from 'react'
import { recoverAccess } from '@/lib/authRecovery'

export default function AuthRecoveryScreen() {
  const [recovering, setRecovering] = useState(false)

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
          Не удалось загрузить урок. Обычно помогает кнопка ниже — данные курса не пострадают, нужно будет заново войти.
        </p>
        <button
          type="button"
          onClick={handleRecovery}
          disabled={recovering}
          style={{ width: '100%', padding: '14px 20px', border: 'none', borderRadius: '12px', background: '#f59e0b', color: 'white', cursor: recovering ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: '15px', fontWeight: 700, opacity: recovering ? 0.7 : 1 }}
        >
          {recovering ? 'Восстанавливаем...' : 'Восстановить доступ'}
        </button>
      </div>
    </div>
  )
}
