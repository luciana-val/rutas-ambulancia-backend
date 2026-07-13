import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not, IsNull } from 'typeorm';
import { Hospital } from '../../entities/hospital.entity';
import { User } from '../../entities/user.entity';
import { Ambulance } from '../../entities/ambulance.entity';
import { AmbulanceStatus } from '../../shared/interfaces';
import { CreateHospitalDto, UpdateHospitalDto } from './dto';

@Injectable()
export class HospitalsService {
  constructor(
    @InjectRepository(Hospital)
    private hospitalRepository: Repository<Hospital>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Ambulance)
    private ambulanceRepository: Repository<Ambulance>,
  ) {}

  async create(dto: CreateHospitalDto): Promise<Hospital> {
    return this.hospitalRepository.save(dto);
  }

  async findAll(search?: string): Promise<Hospital[]> {
    if (search) {
      return this.hospitalRepository.find({
        where: { name: ILike(`%${search}%`) },
        order: { name: 'ASC' },
      });
    }
    return this.hospitalRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Hospital> {
    const hospital = await this.hospitalRepository.findOne({ where: { id } });
    if (!hospital) throw new NotFoundException('Hospital not found');
    return hospital;
  }

  async update(id: string, dto: UpdateHospitalDto): Promise<Hospital> {
    const hospital = await this.findOne(id);
    Object.assign(hospital, dto);
    return this.hospitalRepository.save(hospital);
  }

  async remove(id: string): Promise<void> {
    const hospital = await this.findOne(id);
    await this.ambulanceRepository.delete({ hospitalId: id });
    await this.userRepository.delete({ hospitalId: id });
    await this.hospitalRepository.remove(hospital);
  }

  async findNearest(lat: number, lng: number): Promise<Hospital | null> {
    const hospitals = await this.hospitalRepository.find();
    if (!hospitals.length) return null;
    let nearest = hospitals[0];
    let minDist = Infinity;
    for (const h of hospitals) {
      const dist = this.haversine(lat, lng, h.latitude, h.longitude);
      if (dist < minDist) {
        minDist = dist;
        nearest = h;
      }
    }
    return nearest;
  }

  async findNearestWithAmbulances(lat: number, lng: number): Promise<Hospital | null> {
    const hospitals = await this.hospitalRepository.find();
    if (!hospitals.length) return null;
    const byDist = hospitals
      .map((h) => ({ hospital: h, dist: this.haversine(lat, lng, h.latitude, h.longitude) }))
      .sort((a, b) => a.dist - b.dist);
    for (const { hospital } of byDist) {
      const count = await this.ambulanceRepository.count({
        where: { hospitalId: hospital.id, status: AmbulanceStatus.ACTIVE, latitude: Not(IsNull()), driverId: Not(IsNull()) },
      });
      if (count > 0) return hospital;
    }
    return null;
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
