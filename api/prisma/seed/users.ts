/** Usuários fictícios (LOCAL). Os dois últimos têm soft delete. */
import { day, type Seeder } from "./support.ts";

export const USERS = [
  { name: "Ana Andrade", birthdate: "1995-03-12" },
  { name: "Bruno Andrade", birthdate: "1992-07-30" },
  { name: "Carla Andrade", birthdate: "2001-11-05" },
  { name: "Diego Andrade", birthdate: "2004-02-19" },
  { name: "Elisa Andrade", birthdate: "1968-09-23" },
  { name: "Felipe Costa", birthdate: "1990-05-14" },
  { name: "Gabriela Costa", birthdate: "1993-12-02" },
  { name: "Heitor Costa", birthdate: "2010-06-28" },
  { name: "Isabela Costa", birthdate: "2012-01-17" },
  { name: "João Lima", birthdate: "1998-08-08" },
  { name: "Karina Rocha", birthdate: "1999-04-25" },
  { name: "Lucas Ferraz", birthdate: "1987-10-10" },
  { name: "Marina Ferraz", birthdate: "1989-03-03" },
  { name: "Nicolas Prado", birthdate: "2003-06-06" },
  { name: "Olívia Santos", birthdate: "2005-09-15" },
  { name: "Pedro Nogueira", birthdate: "2004-12-01" },
  { name: "Rafaela Dias", birthdate: "1996-02-29" },
  { name: "Sofia Teixeira", birthdate: "2000-07-07" },
  { name: "Tiago Moura", birthdate: "1985-11-11", deleted: true },
  { name: "Vitória Campos", birthdate: "1997-01-21", deleted: true },
] as const;

export const seedUsers: Seeder["run"] = async (tx) => {
  await tx.user.createMany({
    data: USERS.map((user, i) => ({
      name: user.name,
      birthdate: new Date(user.birthdate),
      createdAt: day(i),
      deletedAt: "deleted" in user ? day(60 + i) : null,
    })),
  });
  const deleted = USERS.filter((user) => "deleted" in user).length;
  return `${USERS.length} usuários (${deleted} com soft delete)`;
};
