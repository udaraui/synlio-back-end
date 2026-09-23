import {
  Column,
  Entity,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { BaseEntity } from '../common/base/base.entity';
import { User } from '../user-management/user/user.entity';

@Entity('note')
export class Note extends BaseEntity {
  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ nullable: true, length: 50 })
  color: string;

  @Column({ nullable: true })
  ownerId: number;

  @Column({ nullable: true })
  companyId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @ManyToMany(() => User)
  @JoinTable({
    name: 'note_shared_users',
    joinColumn: { name: 'noteId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  sharedWith: User[];
}
