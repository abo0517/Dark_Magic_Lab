import { koreanDate, manAge } from './alerts.js'
import { supabase } from './supabaseClient.js'

export function toProfile(row) {
  const [year, month, day] = row.birth_date.split('-').map(Number)
  const age = manAge(year, month, day, koreanDate())
  if (age === null) throw new Error('Invalid birth date')
  return {
    nickname: row.nickname,
    birthDate: row.birth_date,
    age,
    gender: row.gender ?? '',
    gu: row.gu,
    dong: row.dong,
  }
}

export async function loadProfile(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('nickname,birth_date,gender,gu,dong')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? toProfile(data) : null
}

export async function storeProfile(userId, profile) {
  const { error } = await supabase.from('user_profiles').upsert({
    user_id: userId,
    nickname: profile.nickname,
    birth_date: profile.birthDate,
    gender: profile.gender || null,
    gu: profile.gu,
    dong: profile.dong,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw error
}
