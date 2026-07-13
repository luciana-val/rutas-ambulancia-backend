import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Alert } from './alert.entity';
import { Ambulance } from './ambulance.entity';

@Entity('simulation_routes')
export class SimulationRoute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'alert_id' })
  alertId: string;

  @ManyToOne(() => Alert, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alert_id' })
  alert: Alert;

  @Column({ name: 'ambulance_id' })
  ambulanceId: string;

  @ManyToOne(() => Ambulance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ambulance_id' })
  ambulance: Ambulance;

  @Column('jsonb')
  route: number[][];

  @Column('float8')
  duration: number;

  @Column('float8')
  distance: number;

  @Column()
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  returnStartedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
