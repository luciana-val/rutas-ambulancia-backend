import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserRole } from '../shared/interfaces';
import { Hospital } from './hospital.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.DISPATCHER })
  role: UserRole;

  @Column({ name: 'hospital_id', nullable: true })
  hospitalId: string | null;

  @ManyToOne(() => Hospital, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
