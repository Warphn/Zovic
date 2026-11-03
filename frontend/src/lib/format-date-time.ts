// Dates as the admin panel shows them, always in São Paulo time.

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}
