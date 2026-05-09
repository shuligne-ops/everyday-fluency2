'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Если уже залогинен — редирект на главную
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/')
    })
  }, [router])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      })
      if (error) throw error
      setSent(true)
      // НЕ чистим localStorage — UTM нужны на главной странице
      // после клика на magic link, чтобы записать их в user_metadata.
    } catch (err: any) {
      setError(err?.message || 'Что-то пошло не так. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '440px', margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' }}>
        Everyday Fluency
      </h1>
      <p style={{ color: '#888', fontSize: '16px', marginBottom: '40px' }}>
        Разговорный английский каждый день
      </p>

      {!sent ? (
        <form onSubmit={send}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, color: '#1a1a2e', marginBottom: '8px' }}>
            Войти
          </h2>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 }}>
            Введите email — мы пришлём ссылку для входа.<br />
            Пароль не нужен.
          </p>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
            style={{
              width: '100%', padding: '12px 16px', border: '1px solid #ddd', borderRadius: '12px',
              fontSize: '15px', marginBottom: '12px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box'
            }}
          />
          <button
            type="submit"
            disabled={!email.trim() || loading}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              fontSize: '15px', fontWeight: 600, background: '#f59e0b', color: 'white',
              opacity: !email.trim() || loading ? 0.5 : 1, fontFamily: 'inherit'
            }}
          >
            {loading ? 'Отправляем...' : 'Получить ссылку'}
          </button>
          {error && (
            <div style={{ marginTop: '16px', padding: '12px 16px', background: '#fee', borderRadius: '12px', color: '#c00', fontSize: '14px' }}>
              {error}
            </div>
          )}
        </form>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', padding: '32px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📩</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, color: '#1a1a2e', marginBottom: '12px' }}>
            Проверьте почту
          </h2>
          <p style={{ color: '#666', fontSize: '14px', lineHeight: 1.6 }}>
            Мы отправили ссылку для входа на<br />
            <strong style={{ color: '#1a1a2e' }}>{email}</strong>
          </p>
          <p style={{ color: '#999', fontSize: '13px', marginTop: '16px', lineHeight: 1.5 }}>
            Если письмо не пришло — проверьте папку «Спам».<br />
            Ссылка действительна 1 час.
          </p>
        </div>
      )}
    </div>
  )
}
