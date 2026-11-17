// Os comentários vêm da API (lib/api/comments.ts). Aqui ficam o perfil e os helpers de tela do painel.

export interface UserProfile {
  id: number
  name: string
  birthdate: string | null
  isUnderage: boolean
}

export function calculateIsUnderage(birthdate: string | null | undefined, refYear = 2026): boolean {
  if (!birthdate) return true
  const date = new Date(birthdate)
  if (Number.isNaN(date.getTime())) return true

  const now = new Date(`${refYear}-10-20T12:00:00Z`)
  let age = now.getFullYear() - date.getFullYear()
  const m = now.getMonth() - date.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) {
    age--
  }
  return age < 18
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}
