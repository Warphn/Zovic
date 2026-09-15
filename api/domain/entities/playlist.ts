import { ValidationError } from "../errors/domain-error";

export interface ExistingPlaylistData {
    id: string,
    ownerId: string,
    name: string,
    description: string | null,
    isPublic: boolean,
    createdAt: Date,
    updatedAt: Date,
}

export interface NewPlaylistData {
    ownerId: string,
    name: string,
    description?: string | null,
    isPublic?: boolean,
    id?: string,
    now?: Date,
}

export class Playlist {
    static NAME_MAX_LENGTH = 80;
    static DESCRIPTION_MAX_LENGTH = 100;

    private constructor(private readonly existingPlaylistData: ExistingPlaylistData) {}

    static create(newPlaylistData: NewPlaylistData): Playlist {
        const now = newPlaylistData.now ?? new Date();

        return new Playlist({
            id: newPlaylistData.id ?? crypto.randomUUID(),
            ownerId: Playlist.validateOwnerId(newPlaylistData.ownerId),
            name: Playlist.validateName(newPlaylistData.name),
            description: Playlist.normalizedDescription(newPlaylistData.description),
            isPublic: newPlaylistData.isPublic ?? false,
            createdAt: now,
            updatedAt: now,
        });
    }

    private static validateOwnerId(data: string): string {
        const ownerId = data.trim();

        if (ownerId === "") {
            throw new ValidationError("A playlist precisa de um dono.");
        }

        return ownerId;
    }

    private static validateName(data: string): string {
        const name = data.trim();

        if (name === "") {
            throw new ValidationError("A playlist deve ter um nome.");
        }

        if (name.length > Playlist.NAME_MAX_LENGTH) {
            throw new ValidationError(
                `O nome da playlist deve ter no máximo ${Playlist.NAME_MAX_LENGTH} caracteres.`,
            );
        }

        return name;
    }
    
    private static normalizedDescription(value?: string | null): string | null {
        const description = value?.trim();

        if (!description) {
            return null;
        }

        if (description.length > Playlist.DESCRIPTION_MAX_LENGTH) {
            throw new ValidationError(
                `A descrição deve ter no máximo ${Playlist.DESCRIPTION_MAX_LENGTH} caracteres.`,
            );
        }

        return description;
    }
    
}