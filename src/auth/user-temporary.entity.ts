import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Temporary holding table for unverified self-registrations.
 * A row is created when the user submits the registration form.
 * Once the user verifies their email, the data is migrated to the
 * main `user` table and this row is deleted.
 */
@Entity('user_temporary')
export class UserTemporary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  mobile_number: string;

  @Column({ nullable: true })
  profile_picture: string;

  @Column()
  password: string; // bcrypt-hashed

  /** SHA-256 hash of the raw token sent in the verification email. */
  @Column({ unique: true })
  emailVerificationToken: string;

  @Column({ type: 'timestamp' })
  emailVerificationTokenExpiry: Date;

  @CreateDateColumn()
  created_at: Date;
}
