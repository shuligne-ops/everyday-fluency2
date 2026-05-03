// src/lib/access.ts
// Клиент для проверки доступа к урокам.
// Использует helper-функции из Supabase: can_access_level, has_active_subscription.

import { supabase } from './supabase'

export type Lesson = {
  id: number
  level: string
  lesson_number: number
  is_published?: boolean
  is_free_teaser?: boolean
}

export type AccessResult = {
  allowed: boolean
  reason: 'free_a1' | 'free_teaser' | 'subscription' | 'level_grant' | 'admin' | 'paywall' | 'login_required'
}

/**
 * Главная функция: можно ли юзеру открыть этот урок?
 *
 * Правила:
 * 1. A1 — свободный доступ всем (включая незалогиненных)
 * 2. is_free_teaser=TRUE — свободный доступ всем (включая незалогиненных)
 * 3. Остальное — нужен залогиненный юзер с активной подпиской ИЛИ грантом на уровень
 */
export async function checkLessonAccess(
  userId: string | null,
  lesson: Lesson
): Promise<AccessResult> {
  // 1. A1 — всегда открыто
  if (lesson.level === 'A1') {
    return { allowed: true, reason: 'free_a1' }
  }

  // 2. Teaser — всегда открыто
  if (lesson.is_free_teaser) {
    return { allowed: true, reason: 'free_teaser' }
  }

  // 3. Незалогиненный — paywall
  if (!userId) {
    return { allowed: false, reason: 'login_required' }
  }

  // 4. Проверяем подписку через RPC
  try {
    const { data, error } = await supabase.rpc('can_access_level', {
      check_user_id: userId,
      check_level: lesson.level,
    })
    if (error) {
      console.error('[access] can_access_level error:', error)
      return { allowed: false, reason: 'paywall' }
    }
    if (data === true) {
      return { allowed: true, reason: 'subscription' }
    }
  } catch (err) {
    console.error('[access] RPC failed:', err)
  }

  return { allowed: false, reason: 'paywall' }
}

/**
 * Быстрая проверка: есть ли у юзера активная подписка (любая, включая lifetime)?
 * Используется чтобы скрыть/показать тарифы на /pricing.
 */
export async function hasActiveSubscription(userId: string | null): Promise<boolean> {
  if (!userId) return false
  try {
    const { data, error } = await supabase.rpc('has_active_subscription', {
      check_user_id: userId,
    })
    if (error) {
      console.error('[access] has_active_subscription error:', error)
      return false
    }
    return data === true
  } catch (err) {
    console.error('[access] RPC failed:', err)
    return false
  }
}

/**
 * Возвращает текущую подписку пользователя (или null).
 * Только сам юзер может прочитать через RLS.
 */
export async function getUserSubscription(userId: string) {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('plan, status, starts_at, expires_at, amount_paid, currency')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[access] getUserSubscription error:', error)
    return null
  }
  return data
}
