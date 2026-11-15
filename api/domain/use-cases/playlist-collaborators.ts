import type { Playlist } from "../entities/playlist.ts";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors/domain-error.ts";
import type { PlaylistRepository } from "../ports/playlist-repository.ts";
import type { SubscriptionRepository } from "../ports/subscription-repository.ts";
import type { UserEmailLookup, UserRepository } from "../ports/user-repository.ts";
import { findVisiblePlaylist } from "./find-visible-playlist.ts";

// Colaboradores de uma playlist (HU-19). O dono é o admin da playlist; o colaborador é um membro
// sem ser admin: ele mexe nas músicas, mas não renomeia, não apaga e não gerencia colaboradores.

/** Uma pessoa da playlist, sem email: quem vê uma playlist pública vê a lista. */
export interface Collaborator {
  userId: number;
  name: string;
  isOwner: boolean;
}

async function toCollaborators(playlist: Playlist, users: UserRepository): Promise<Collaborator[]> {
  const collaborators: Collaborator[] = [];
  for (const member of playlist.members) {
    const profile = await users.findById(member.userId);
    if (profile) collaborators.push({ userId: member.userId, name: profile.name, isOwner: member.isAdmin });
  }
  // O dono primeiro; os colaboradores pelo nome
  return collaborators.toSorted(
    (first, second) => Number(second.isOwner) - Number(first.isOwner) || first.name.localeCompare(second.name, "pt-BR"),
  );
}

export interface ListCollaboratorsInput {
  userId: number;
  playlistId: number;
}

export interface ListCollaboratorsUseCase {
  execute(input: ListCollaboratorsInput): Promise<Collaborator[]>;
}

/** Quem vê a playlist vê quem a monta. */
export class ListCollaborators implements ListCollaboratorsUseCase {
  constructor(
    private readonly playlists: PlaylistRepository,
    private readonly users: UserRepository,
  ) {}

  async execute({ userId, playlistId }: ListCollaboratorsInput): Promise<Collaborator[]> {
    const playlist = await findVisiblePlaylist(this.playlists, playlistId, userId);
    return toCollaborators(playlist, this.users);
  }
}

export interface AddCollaboratorInput {
  userId: number;
  playlistId: number;
  email: string;
}

export interface AddCollaboratorUseCase {
  execute(input: AddCollaboratorInput): Promise<Collaborator[]>;
}

/** Só o dono. A pessoa entra direto, pelo email de uma conta com assinatura ativa. */
export class AddCollaborator implements AddCollaboratorUseCase {
  constructor(
    private readonly playlists: PlaylistRepository,
    private readonly users: UserRepository & UserEmailLookup,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute({ userId, playlistId, email }: AddCollaboratorInput): Promise<Collaborator[]> {
    const playlist = await findVisiblePlaylist(this.playlists, playlistId, userId);
    if (!playlist.isAdmin(userId)) {
      throw new ForbiddenError("Only the playlist owner manages collaborators");
    }

    const account = await this.users.findByEmail(email.trim().toLowerCase());
    if (!account) throw new NotFoundError("Account not found");
    // Sem plano, a pessoa nem acessa as playlists
    if (!(await this.subscriptions.findActiveByUser(account.id))) {
      throw new BusinessRuleError("This account has no active subscription");
    }

    playlist.addMember(account.id);
    await this.playlists.save(playlist);
    return toCollaborators(playlist, this.users);
  }
}

export interface RemoveCollaboratorInput {
  userId: number;
  playlistId: number;
  collaboratorId: number;
}

export interface RemoveCollaboratorUseCase {
  execute(input: RemoveCollaboratorInput): Promise<void>;
}

/**
 * O dono remove qualquer colaborador; o colaborador só remove a si mesmo, que é sair da playlist.
 * O dono não sai: a entidade recusa tirar o último admin.
 */
export class RemoveCollaborator implements RemoveCollaboratorUseCase {
  constructor(private readonly playlists: PlaylistRepository) {}

  async execute({ userId, playlistId, collaboratorId }: RemoveCollaboratorInput): Promise<void> {
    const playlist = await findVisiblePlaylist(this.playlists, playlistId, userId);
    const isLeaving = collaboratorId === userId;
    if (!isLeaving && !playlist.isAdmin(userId)) {
      throw new ForbiddenError("Only the playlist owner manages collaborators");
    }
    if (!playlist.isMember(collaboratorId)) {
      throw new NotFoundError("Collaborator not found");
    }

    playlist.removeMember(collaboratorId);
    await this.playlists.save(playlist);
  }
}
