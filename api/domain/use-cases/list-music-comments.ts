import { NotFoundError } from "../errors/domain-error.ts";
import type { CommentRepository } from "../ports/comment-repository.ts";
import type { UserRepository } from "../ports/user-repository.ts";
import { isUnderage } from "../shared/user-age.ts";

export interface ListMusicCommentsInput {
  viewerId: number;
  musicId: number;
}

export interface CommentItemOutput {
  id: number;
  musicId: number;
  userId: number;
  authorName: string;
  comment: string;
  timestamp: number | null;
  createdAt: string;
  isMine: boolean;
}

export interface ListMusicCommentsUseCase {
  execute(input: ListMusicCommentsInput): Promise<CommentItemOutput[]>;
}

export class ListMusicComments implements ListMusicCommentsUseCase {
  constructor(
    private readonly comments: CommentRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(input: ListMusicCommentsInput): Promise<CommentItemOutput[]> {
    const viewer = await this.users.findById(input.viewerId);
    if (!viewer || viewer.deletedAt) {
      throw new NotFoundError("User not found");
    }

    // Regra: menores de idade (ou birthdate vazio) não têm visualização de comentários
    if (isUnderage(viewer.birthdate)) {
      return [];
    }

    const rawComments = await this.comments.listActiveByMusicId(input.musicId);

    return rawComments.map((item) => ({
      id: item.id,
      musicId: item.musicId,
      userId: item.userId,
      authorName: item.authorName,
      comment: item.comment,
      timestamp: item.timestamp,
      createdAt: item.createdAt.toISOString(),
      isMine: item.userId === input.viewerId,
    }));
  }
}

