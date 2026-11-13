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

