import { BusinessRuleError, ValidationError } from "../errors/domain-error";
import { normalizeHexColor } from "../shared/hex-color";

export interface PlaylistMember {
    userId: number;
    isAdmin: boolean;
}

export interface ExistingPlaylistData {
    id: number;
    name: string;
    isPrivate: boolean;
    color: string|null;
    members: PlaylistMember[];
    createdAt: Date;
    deletedAt: Date|null;
}

export interface NewPlaylistData {
    id: number;
    creatorId: number;
    name: string;
    isPrivate?: boolean;
    color?: string|null;
    now?: Date;
}

export class Playlist {
    static readonly MAX_NAME_LENGTH = 150;

    private constructor( private readonly input: ExistingPlaylistData ) {}

    static create( input: NewPlaylistData ): Playlist {
        return new Playlist({
            id: input.id,
            name: Playlist.validateName(input.name),
            isPrivate: input.isPrivate ?? false,
            color: Playlist.normalizeHexColor(input.color ?? null),
            members: [{ userId: input.creatorId, isAdmin: true }],
            createdAt: input.now ?? new Date(),
            deletedAt: null
        });
    }

    static restore( input: ExistingPlaylistData ): Playlist {
        return new Playlist({ ...input, members: input.members.map((m) => ({ ...m })) });
    }

    get id(): number {
        return this.input.id;
    }

    get name(): string {
        return this.input.name;
    }
    
    get isPrivate(): boolean {
        return this.input.isPrivate;
    }

    get color(): string|null {
        return this.input.color;
    }

    get members(): PlaylistMember[] {
        return this.input.members.map((m) => ({ ...m }));
    }

    get createdAt(): Date {
        return new Date(this.input.createdAt);
    }

    get deletedAt(): Date|null {
        return this.input.deletedAt ? new Date(this.input.deletedAt) : null;
    }

    toData(): ExistingPlaylistData {
        return {
            ...this.input,
            members: this.input.members.map((m) => ({ ...m })),
        };
    }

    private static validateName(name: string): string {
        const trimname = name.trim();
        if (trimname.length === 0) {
            throw new ValidationError("Playlist name cannot be empty");
        }
        if (trimname.length > Playlist.MAX_NAME_LENGTH) {
            throw new ValidationError(`Playlist name cannot exceed ${Playlist.MAX_NAME_LENGTH} characters`);
        }
        return trimname;
    }

    private static normalizeHexColor(color: string|null): string|null {
        if (color === null) {
            return null;
        }
        return normalizeHexColor(color);
    }

    isMember(userId: number): boolean {
        return this.input.members.some((m) => m.userId === userId);
    }

    isAdmin(userId: number): boolean {
        return this.input.members.some((m) => m.userId === userId && m.isAdmin);
    }

    addMember(userId: number): void {
        this.ensureNotDeleted();
        if (this.isMember(userId)) {
            throw new BusinessRuleError("User is already a member of this playlist");
        }
        this.input.members.push({ userId, isAdmin: false });
    }

    removeMember(userId: number): void {
        this.ensureNotDeleted();
        const member = this.input.members.find((m) => m.userId === userId);
        if (!member) {
            throw new BusinessRuleError("User is not a member of this playlist");
        }
        const adminCount = this.input.members.filter((m) => m.isAdmin).length;
        if (member.isAdmin && adminCount === 1) {
            throw new BusinessRuleError("The last admin cannot leave the playlist");
        }
        this.input.members = this.input.members.filter((m) => m.userId !== userId);
    }

    promote(userId: number): void {
        this.ensureNotDeleted();
        const member = this.input.members.find((m) => m.userId === userId);
        if (!member) {
            throw new BusinessRuleError("User is not a member of this playlist");
        }
        member.isAdmin = true;
    }

    rename(name: string): void {
        this.ensureNotDeleted();
        this.input.name = Playlist.validateName(name);
    }

    changeColor(color: string | null): void {
        this.ensureNotDeleted();
        this.input.color = Playlist.normalizeHexColor(color);
    }

    setPrivate(isPrivate: boolean): void {
        this.ensureNotDeleted();
        this.input.isPrivate = isPrivate;
    }

    delete(now: Date = new Date()): void {
        this.ensureNotDeleted();
        this.input.deletedAt = now;
    }

    private ensureNotDeleted(): void {
        if (this.input.deletedAt !== null) {
            throw new BusinessRuleError("This playlist has been deleted");
        }
    }
}