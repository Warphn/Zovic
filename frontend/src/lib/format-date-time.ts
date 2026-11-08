// Dates as the pages show them, always in São Paulo time.

const TIME_ZONE = "America/Sao_Paulo"

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE })

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TIME_ZONE })
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE })

/** "2026-11-05T17:32:00Z" → "05/11 às 14:32", in São Paulo time. */
export function formatDayAndTime(iso: string): string {
  const date = new Date(iso)
  return `${day.format(date)} às ${time.format(date)}`
}
