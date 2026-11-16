export interface UserProfile {
  id: number;
  name: string;
  /** "AAAA-MM-DD", ou null se a conta não tem data de nascimento. */
  birthdate: string | null;
  deletedAt: Date | null;
}

export interface UserRepository {
  findById(id: number): Promise<UserProfile | null>;
}

/** Busca de conta pelo email, para quem precisa achar outra pessoa, como o dono que adiciona um colaborador (HU-19). */
export interface UserEmailLookup {
  /** A conta ativa (sem `deleted_at`) com esse email, já em minúsculas, ou null. */
  findByEmail(email: string): Promise<UserProfile | null>;
}

