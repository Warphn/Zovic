import { describe, expect, it } from "bun:test";
import { BusinessRuleError, NotFoundError } from "../errors/domain-error.ts";
import type { AdminUserItem, NewAccountInput, UserAccounts } from "../ports/admin-queries.ts";
import { ManageUsers } from "./manage-users.ts";

/** O erro com que a promessa rejeita; falha o teste se ela resolver. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject");
}

type Account = { id: number; role: "admin" | "assinante"; deletedAt: Date | null; email: string };

class InMemoryAccounts implements UserAccounts {
  readonly items: Account[] = [];

  async create(input: NewAccountInput): Promise<AdminUserItem> {
    const id = this.items.length + 1;
    this.items.push({ id, role: input.role, deletedAt: null, email: input.email });
    return {
      id,
      name: input.name,
      email: input.email,
      role: input.role,
      birthdate: input.birthdate,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      plays: 0,
      lastPlayAt: null,
    };
  }

  async find(id: number) {
    return this.items.find((account) => account.id === id) ?? null;
  }

  async countActiveAdmins(): Promise<number> {
    return this.items.filter((account) => account.role === "admin" && !account.deletedAt).length;
  }

  async remove(id: number): Promise<void> {
    const account = this.items.find((a) => a.id === id);
    if (account) account.deletedAt = new Date();
  }
}

async function setup(roles: Account["role"][]) {
  const accounts = new InMemoryAccounts();
  for (const [i, role] of roles.entries()) {
    await accounts.create({ name: `U${i}`, email: `u${i}@x.test`, password: "12345678", birthdate: "2000-01-01", role });
  }
  return { accounts, users: new ManageUsers(accounts) };
}

describe("ManageUsers", () => {
  it("cria com nome aparado e email em minúsculas", async () => {
    const { accounts, users } = await setup([]);

    await users.create({ name: "  Ana ", email: " ANA@X.test ", password: "12345678", birthdate: "2000-01-01", role: "assinante" });

    expect(accounts.items[0]?.email).toBe("ana@x.test");
  });

  it("remove outro usuário com soft delete", async () => {
    const { accounts, users } = await setup(["admin", "assinante"]);

    await users.remove(1, 2);

    expect(accounts.items[1]?.deletedAt).toBeInstanceOf(Date);
  });

  it("não deixa o admin remover a própria conta", async () => {
    const { users } = await setup(["admin", "admin"]);

    expect(await rejection(users.remove(1, 1))).toBeInstanceOf(BusinessRuleError);
  });

  it("remove um admin quando sobra outro ativo", async () => {
    const { accounts, users } = await setup(["admin", "admin"]);

    await users.remove(1, 2);

    expect(await accounts.countActiveAdmins()).toBe(1);
  });

  it("recusa remover o último admin, mesmo pedido por outra conta", async () => {
    const { users } = await setup(["admin", "assinante"]);

    expect(await rejection(users.remove(2, 1))).toBeInstanceOf(BusinessRuleError);
  });

  it("usuário inexistente ou já removido dá 404", async () => {
    const { users } = await setup(["admin", "assinante"]);
    await users.remove(1, 2);

    expect(await rejection(users.remove(1, 2))).toBeInstanceOf(NotFoundError);
    expect(await rejection(users.remove(1, 99))).toBeInstanceOf(NotFoundError);
  });
});
