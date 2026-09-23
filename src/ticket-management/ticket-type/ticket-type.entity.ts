import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';

@Entity()
export class TicketType extends BaseEntity {
  @Column({ unique: false, nullable: false })
  name: string;

  @Column()
  color: string;

  @Column({ nullable: true })
  icon: string;
}
