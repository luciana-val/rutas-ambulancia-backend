import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { AmbulanceStatus } from '../shared/interfaces';
import { Hospital } from './hospital.entity';
import { User } from './user.entity';

@Entity('ambulances')
export class Ambulance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  plate: string;

  @Column({ nullable: true })
  model: string;

  @Column({ name: 'plate_photo', nullable: true })
  platePhoto: string;

  @Column({ type: 'enum', enum: AmbulanceStatus, default: AmbulanceStatus.INACTIVE })
  status: AmbulanceStatus;

  @Column('float8', { nullable: true })
  latitude: number;

  @Column('float8', { nullable: true })
  longitude: number;

  @Column({ name: 'hospital_id' })
  hospitalId: string;

  @ManyToOne(() => Hospital, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital;

  @Column({ name: 'driver_id', nullable: true })
  driverId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @Column({ name: 'last_location_update', nullable: true })
  lastLocationUpdate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
