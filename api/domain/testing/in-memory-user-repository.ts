import type { UserEmailLookup, UserProfile, UserRepository } from "../ports/user-repository.ts";

interface UserAccount {
  profile: UserProfile;
  email: string;
}

/** Fake das contas para os testes de domínio: acha pelo id e pelo email exato, como a consulta real. */
export class InMemoryUserRepository implements UserRepository, UserEmailLookup {
  constructor(private readonly accounts: UserAccount[]) {}

  findById(id: number): Promise<UserProfile | null> {
    return Promise.resolve(this.accounts.find((account) => account.profile.id === id)?.profile ?? null);
  }

  findByEmail(email: string): Promise<UserProfile | null> {
    const account = this.accounts.find((candidate) => candidate.email === email && candidate.profile.deletedAt === null);
    return Promise.resolve(account?.profile ?? null);
  }
}
