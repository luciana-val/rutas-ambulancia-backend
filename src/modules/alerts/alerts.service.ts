import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, Like } from 'typeorm';
import { Alert } from '../../entities/alert.entity';
import { AlertStatus } from '../../shared/interfaces';
import { CreateAlertDto, UpdateAlertDto } from './dto';

interface FindAllFilters {
  hospitalId?: string;
  status?: string[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
  ) {}

  async create(dto: CreateAlertDto): Promise<Alert> {
    return this.alertRepository.save(dto);
  }

  async findAll(filters: FindAllFilters = {}): Promise<Alert[]> {
    const where: any = {};

    if (filters.hospitalId) where.hospitalId = filters.hospitalId;
    if (filters.status?.length) where.status = In(filters.status);

    if (filters.dateFrom && filters.dateTo) {
      where.createdAt = Between(new Date(filters.dateFrom), new Date(filters.dateTo));
    } else if (filters.dateFrom) {
      where.createdAt = Between(new Date(filters.dateFrom), new Date());
    } else if (filters.dateTo) {
      where.createdAt = Between(new Date('2000-01-01'), new Date(filters.dateTo));
    }

    if (filters.search) {
      const num = parseInt(filters.search, 10);
      if (!isNaN(num)) {
        where.alertNumber = num;
      } else {
        where.description = Like(`%${filters.search}%`);
      }
    }

    return this.alertRepository.find({
      where,
      relations: { ambulance: true, hospital: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Alert> {
    const alert = await this.alertRepository.findOne({ where: { id }, relations: { ambulance: true, hospital: true } });
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  async update(id: string, dto: UpdateAlertDto): Promise<Alert> {
    const alert = await this.findOne(id);
    Object.assign(alert, dto);
    return this.alertRepository.save(alert);
  }

  async remove(id: string): Promise<void> {
    const alert = await this.findOne(id);
    await this.alertRepository.remove(alert);
  }

  async resetInProgressAlerts(): Promise<void> {
    await this.alertRepository.update(
      { status: In([AlertStatus.ASSIGNED, AlertStatus.EN_ROUTE]) },
      { status: AlertStatus.PENDING, ambulanceId: null as any },
    );
  }
}
