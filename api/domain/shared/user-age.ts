export function calculateAge(birthdate: Date, referenceDate = new Date()): number {
  let age = referenceDate.getFullYear() - birthdate.getFullYear();
  const m = referenceDate.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < birthdate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Determina se o usuário é menor de 18 anos.
 * Regra: birthdate vazio ou não informado é tratado como menor de idade.
 */
export function isUnderage(birthdate: Date | string | null | undefined, referenceDate = new Date()): boolean {
  if (!birthdate) {
    return true;
  }
  const dateObj = typeof birthdate === "string" ? new Date(birthdate) : birthdate;
  if (Number.isNaN(dateObj.getTime())) {
    return true;
  }
  return calculateAge(dateObj, referenceDate) < 18;
}

