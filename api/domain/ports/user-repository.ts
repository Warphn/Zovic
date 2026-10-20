export interface UserProfile {
  id: number;
  name: string;
  birthdate: Date | null;
  deletedAt: Date | null;
}

export interface UserRepository {
  findById(id: number): Promise<UserProfile | null>;
}

