import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Generated } from 'typeorm';
import { AlertStatus } from '../shared/interfaces';
import { Hospital } from './hospital.entity';
import { Ambulance } from './ambulance.entity';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  @Generated('increment')
  alertNumber: number;

  @Column({ name: 'hospital_id' })
  hospitalId: string;

  @ManyToOne(() => Hospital, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital;

  @Column('float8')
  latitude: number;

  @Column('float8')
  longitude: number;

  @Column()
  description: string;

  @Column({ name: 'caller_name', nullable: true })
  callerName: string;

  @Column({ name: 'caller_phone', nullable: true })
  callerPhone: string;

  @Column({ type: 'enum', enum: AlertStatus, default: AlertStatus.PENDING })
  status: AlertStatus;

  @Column({ name: 'ambulance_id', nullable: true })
  ambulanceId: string;

  @ManyToOne(() => Ambulance, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ambulance_id' })
  ambulance: Ambulance;

  @Column({ name: 'is_simulation', default: false })
  isSimulation: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
