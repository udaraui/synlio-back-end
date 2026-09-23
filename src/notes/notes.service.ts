import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Note } from './note.entity';
import { CreateNoteDto, ShareNoteDto, UpdateNoteDto } from './dto/note.dto';
import { User } from '../user-management/user/user.entity';

@Injectable()
export class NotesService {
  constructor(private readonly entityManager: EntityManager) {}

  private buildWhere(id: number | undefined, authUser: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const where: any = { ownerId: authUser.userId };
    if (id !== undefined) where.id = id;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (authUser.activeCompanyId) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      where.companyId = authUser.activeCompanyId;
    }
    return where;
  }

  async createNote(dto: CreateNoteDto, authUser: any): Promise<Note> {
    const note = new Note();
    note.content = dto.content ?? '';
    if (dto.color) note.color = dto.color;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    note.ownerId = authUser.userId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    note.companyId = authUser.activeCompanyId ?? null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    note.createdBy = authUser.email;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    note.updatedBy = authUser.email;
    note.sharedWith = [];
    return await this.entityManager.save(Note, note);
  }

  async getMyNotes(authUser: any): Promise<Note[]> {
    return await this.entityManager.find(Note, {
      where: this.buildWhere(undefined, authUser),
      relations: ['sharedWith'],
      order: { updatedAt: 'DESC' },
    });
  }

  async getSharedWithMe(authUser: any): Promise<any[]> {
    const qb = this.entityManager
      .createQueryBuilder(Note, 'note')
      .innerJoinAndSelect(
        'note.sharedWith',
        'sharedUser',
        'sharedUser.id = :userId',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        { userId: authUser.userId },
      )
      .leftJoinAndSelect('note.owner', 'owner')
      .orderBy('note.updatedAt', 'DESC');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (authUser.activeCompanyId) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      qb.where('note.companyId = :companyId', { companyId: authUser.activeCompanyId });
    }

    const notes = await qb.getMany();
    return notes.map((note) => ({
      ...note,
      ownerName: `${note.owner.first_name} ${note.owner.last_name}`,
      ownerEmail: note.owner.email,
      ownerProfilePicture: note.owner.profile_picture ?? null,
    }));
  }

  async updateNote(id: number, dto: UpdateNoteDto, authUser: any): Promise<Note> {
    const note = await this.entityManager.findOne(Note, {
      where: this.buildWhere(id, authUser),
    });
    if (!note) throw new NotFoundException('Note not found');
    if (dto.content !== undefined) note.content = dto.content;
    if (dto.color !== undefined) note.color = dto.color;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    note.updatedBy = authUser.email;
    return await this.entityManager.save(Note, note);
  }

  async deleteNote(id: number, authUser: any): Promise<void> {
    const note = await this.entityManager.findOne(Note, {
      where: this.buildWhere(id, authUser),
    });
    if (!note) throw new NotFoundException('Note not found');
    await this.entityManager.delete(Note, { id });
  }

  async shareNote(id: number, dto: ShareNoteDto, authUser: any): Promise<{ sharedWith: any[] }> {
    const note = await this.entityManager.findOne(Note, {
      where: this.buildWhere(id, authUser),
      relations: ['sharedWith'],
    });
    if (!note) throw new NotFoundException('Note not found');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const userIds = dto.userIds.filter((uid) => uid !== authUser.userId);
    note.sharedWith = userIds.map((uid) => ({ id: uid } as User));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    note.updatedBy = authUser.email;
    await this.entityManager.save(Note, note);

    return this.getShareList(id, authUser);
  }

  async getShareList(id: number, authUser: any): Promise<{ sharedWith: any[] }> {
    const note = await this.entityManager.findOne(Note, {
      where: this.buildWhere(id, authUser),
      relations: ['sharedWith'],
    });
    if (!note) throw new NotFoundException('Note not found');

    const sharedWith = (note.sharedWith ?? []).map((u) => ({
      userId: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      profile_picture: u.profile_picture ?? null,
    }));

    return { sharedWith };
  }
}
