export const ADULT_AGE = 18;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Maior de idade a partir do dia em que completa ADULT_AGE anos. As datas são "AAAA-MM-DD"
 * e a comparação é de texto: quem nasceu em 29/02 completa a idade em 1º/03 nos anos não
 * bissextos (Código Civil, art. 132 §3º). Sem data de nascimento, a resposta é `false`:
 * na dúvida, vale a regra mais restritiva.
 */
export function isAdult(birthdate: string | null, today: string): boolean {
  if (!birthdate || !ISO_DATE.test(birthdate) || !ISO_DATE.test(today)) {
    return false;
  }
  const year = Number(today.slice(0, 4)) - ADULT_AGE;
  const birthdayThisAge = `${String(year).padStart(4, "0")}${today.slice(4)}`;
  return birthdate <= birthdayThisAge;
}

/** O dia do calendário ("AAAA-MM-DD") de um instante, no fuso informado. */
export function calendarDateIn(instant: Date, timeZone: string): string {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    instant,
  );
}
