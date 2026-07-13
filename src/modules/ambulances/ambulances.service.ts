import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ambulance } from '../../entities/ambulance.entity';
import { AmbulanceStatus } from '../../shared/interfaces';
import { CreateAmbulanceDto, UpdateAmbulanceDto, UpdateLocationDto } from './dto';

@Injectable()
export class AmbulancesService {
  constructor(
    @InjectRepository(Ambulance)
    private ambulanceRepository: Repository<Ambulance>,
  ) {}

  async create(dto: CreateAmbulanceDto): Promise<Ambulance> {
    return this.ambulanceRepository.save(dto);
  }

  async findAll(hospitalId?: string): Promise<Ambulance[]> {
    const where: any = {};
    if (hospitalId) where.hospitalId = hospitalId;
    return this.ambulanceRepository.find({ where, relations: { driver: true }, order: { plate: 'ASC' } });
  }

  async findOne(id: string): Promise<Ambulance> {
    const ambulance = await this.ambulanceRepository.findOne({ where: { id }, relations: { driver: true } });
    if (!ambulance) throw new NotFoundException('Ambulance not found');
    return ambulance;
  }

  async update(id: string, dto: UpdateAmbulanceDto): Promise<Ambulance> {
    const ambulance = await this.findOne(id);
    if (dto.removeDriver) {
      ambulance.driverId = null as any;
      ambulance.driver = null as any;
    }
    const { removeDriver, ...rest } = dto;
    Object.assign(ambulance, rest);
    return this.ambulanceRepository.save(ambulance);
  }

  async remove(id: string): Promise<void> {
    const ambulance = await this.findOne(id);
    await this.ambulanceRepository.remove(ambulance);
  }

  async resetAllToActive(): Promise<void> {
    const all = await this.ambulanceRepository.find({ relations: { hospital: true } });
    const toSave: Ambulance[] = [];
    for (const amb of all) {
      if (!amb.driverId) continue;
      amb.status = AmbulanceStatus.ACTIVE;
      if (amb.hospital?.latitude && amb.hospital?.longitude) {
        amb.latitude = amb.hospital.latitude;
        amb.longitude = amb.hospital.longitude;
        amb.lastLocationUpdate = new Date();
      }
      toSave.push(amb);
    }
    if (toSave.length) await this.ambulanceRepository.save(toSave);
  }

  async updateLocation(id: string, dto: UpdateLocationDto, driverId: string): Promise<Ambulance> {
    const ambulance = await this.findOne(id);
    if (ambulance.driverId !== driverId) {
      throw new ForbiddenException('You can only update your assigned ambulance location');
    }
    ambulance.latitude = dto.latitude;
    ambulance.longitude = dto.longitude;
    ambulance.lastLocationUpdate = new Date();
    return this.ambulanceRepository.save(ambulance);
  }
}
