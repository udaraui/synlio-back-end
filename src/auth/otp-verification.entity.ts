import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('otp_verifications')
export class OtpVerification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  hashed_otp: string;

  @Column({ type: 'timestamp' })
  expiry: Date;

  @Column({ default: 0 })
  attempts: number;

  @CreateDateColumn()
  created_at: Date;
}
