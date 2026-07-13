import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SimulationRoute } from '../../entities/simulation-route.entity';
import { AmbulancesService } from '../ambulances/ambulances.service';
import { AlertsService } from '../alerts/alerts.service';
import { HospitalsService } from '../hospitals/hospitals.service';
import { AmbulanceStatus, AlertStatus } from '../../shared/interfaces';

@Injectable()
export class SimulationService {
  private enabled = false;
  private startedAt: Date | null = null;
  private readonly logger = new Logger(SimulationService.name);

  constructor(
    @InjectRepository(SimulationRoute)
    private routeRepository: Repository<SimulationRoute>,
    private ambulancesService: AmbulancesService,
    private alertsService: AlertsService,
    private hospitalsService: HospitalsService,
  ) {}

  getStatus() {
    return { enabled: this.enabled, startedAt: this.startedAt };
  }

  async toggle(): Promise<{ enabled: boolean; startedAt: Date | null }> {
    this.enabled = !this.enabled;
    this.startedAt = this.enabled ? new Date() : null;

    if (this.enabled) {
      await this.routeRepository.delete({});
      await this.alertsService.resetInProgressAlerts();
      await this.ambulancesService.resetAllToActive();
    }

    return { enabled: this.enabled, startedAt: this.startedAt };
  }

  async assignAlert(alertId: string) {
    const alert = await this.alertsService.findOne(alertId);
    if (alert.status !== AlertStatus.PENDING) {
      throw new BadRequestException('Alert is not pending');
    }

    const ambulances = await this.ambulancesService.findAll(alert.hospitalId);
    const activeAmbulances = ambulances.filter((a) => a.status === AmbulanceStatus.ACTIVE && a.latitude && a.longitude);

    if (activeAmbulances.length === 0) {
      throw new BadRequestException('No active ambulances available');
    }

    const nearest = activeAmbulances.reduce((best, a) => {
      const dist = this.haversine(alert.latitude, alert.longitude, a.latitude!, a.longitude!);
      return dist < best.dist ? { ambulance: a, dist } : best;
    }, { ambulance: activeAmbulances[0], dist: Infinity }).ambulance;

    await this.alertsService.update(alertId, {
      status: AlertStatus.ASSIGNED,
      ambulanceId: nearest.id,
    });

    await this.ambulancesService.update(nearest.id, { status: AmbulanceStatus.BUSY });

    return { ambulance: nearest };
  }

  async createPublicAlert(lat: number, lng: number) {
    const hospital = await this.hospitalsService.findNearestWithAmbulances(lat, lng);
    if (!hospital) throw new BadRequestException('No hay ambulancias disponibles en ningún hospital cercano');

    const alert = await this.alertsService.create({
      hospitalId: hospital.id,
      latitude: lat,
      longitude: lng,
      description: 'Alerta de emergencia',
    });
    await this.alertsService.update(alert.id, { isSimulation: true });

    const ambulances = await this.ambulancesService.findAll(hospital.id);
    const active = ambulances.filter(
      (a) => a.status === AmbulanceStatus.ACTIVE && a.latitude && a.longitude && a.driverId,
    );

    const nearest = active.reduce((best, a) => {
      const dist = this.haversine(alert.latitude, alert.longitude, a.latitude!, a.longitude!);
      return dist < best.dist ? { ambulance: a, dist } : best;
    }, { ambulance: active[0], dist: Infinity }).ambulance;

    const updatedAlert = await this.alertsService.update(alert.id, {
      status: AlertStatus.ASSIGNED,
      ambulanceId: nearest.id,
    });
    await this.ambulancesService.update(nearest.id, { status: AmbulanceStatus.BUSY });

    return {
      alert: updatedAlert,
      ambulance: {
        id: nearest.id,
        plate: nearest.plate,
        latitude: nearest.latitude,
        longitude: nearest.longitude,
        driverName: nearest.driver!.name,
      },
      hospital: { id: hospital.id, name: hospital.name, latitude: hospital.latitude, longitude: hospital.longitude },
    };
  }

  async saveRoute(alertId: string, ambulanceId: string, route: number[][], duration: number, distance: number) {
    const alert = await this.alertsService.findOne(alertId);
    if (alert.status !== AlertStatus.ASSIGNED) {
      throw new BadRequestException('Alert is not assigned');
    }

    const routeEntity = this.routeRepository.create({
      alertId,
      ambulanceId,
      route,
      duration,
      distance,
      startedAt: new Date(),
    });
    await this.routeRepository.save(routeEntity);

    await this.alertsService.update(alertId, { status: AlertStatus.EN_ROUTE });
    await this.ambulancesService.update(ambulanceId, { status: AmbulanceStatus.BUSY });

    return routeEntity;
  }

  async cancelAlert(alertId: string) {
    const alert = await this.alertsService.findOne(alertId);
    await this.alertsService.update(alertId, { status: AlertStatus.CANCELLED });
    if (alert.ambulanceId) {
      await this.ambulancesService.update(alert.ambulanceId, { status: AmbulanceStatus.ACTIVE });
    }
    await this.routeRepository.delete({ alertId });
    return { message: 'Alerta cancelada' };
  }

  async startReturn(alertId: string) {
    const route = await this.routeRepository.findOne({ where: { alertId } });
    if (!route) throw new NotFoundException('Simulation route not found');
    
    route.returnStartedAt = new Date();
    await this.routeRepository.save(route);
    return { message: 'Return trip started' };
  }

  async getPositions(hospitalId?: string) {
    const routes = await this.routeRepository.find({
      relations: { alert: true, ambulance: true },
      order: { createdAt: 'DESC' },
    });

    const now = Date.now();
    const positions: any[] = [];

    for (const r of routes) {
      if (r.alert.hospitalId !== hospitalId && hospitalId) continue;

      const speedMultiplier = 10;
      let progress = 0;
      let currentRoute = r.route;
      let status = 'en_route';

      if (r.returnStartedAt) {
        const elapsedReturn = now - r.returnStartedAt.getTime();
        const totalDuration = r.duration * 1000 / speedMultiplier;
        progress = Math.min(elapsedReturn / totalDuration, 1);
        
        // Invert route for return trip
        currentRoute = [...r.route].reverse();
        status = progress >= 1 ? 'completed' : 'returning';
      } else {
        const elapsed = now - r.startedAt.getTime();
        const totalDuration = r.duration * 1000 / speedMultiplier;
        progress = Math.min(elapsed / totalDuration, 1);
        status = progress >= 1 ? 'at_scene' : 'en_route';

        if (progress >= 1) {
          const arrivalTime = r.startedAt.getTime() + totalDuration;
          if (now - arrivalTime > 15000) {
            r.returnStartedAt = new Date();
            await this.routeRepository.save(r);
            status = 'returning';
            const elapsedReturn = now - r.returnStartedAt.getTime();
            progress = Math.min(elapsedReturn / totalDuration, 0);
            currentRoute = [...r.route].reverse();
          }
        }
      }

      const pos = this.interpolate(currentRoute, progress);
      positions.push({
        ambulanceId: r.ambulanceId,
        alertId: r.alertId,
        latitude: pos[1],
        longitude: pos[0],
        progress,
        status,
        route: currentRoute,
        plate: r.ambulance?.plate || '',
      });

      if (r.returnStartedAt && progress >= 1) {
        await this.alertsService.update(r.alertId, { status: AlertStatus.COMPLETED });
        await this.ambulancesService.update(r.ambulanceId, { status: AmbulanceStatus.ACTIVE });
        await this.routeRepository.delete(r.id);
      }
    }


    return positions;
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private interpolate(route: number[][], progress: number): [number, number] {
    if (route.length === 0) return [0, 0];
    if (progress >= 1) return route[route.length - 1] as [number, number];
    if (progress <= 0) return route[0] as [number, number];
    const totalLength = this.routeLength(route);
    const targetDist = totalLength * progress;
    let accumulated = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const seg = this.segmentDistance(route[i], route[i + 1]);
      if (accumulated + seg >= targetDist) {
        const t = (targetDist - accumulated) / seg;
        return [
          route[i][0] + (route[i + 1][0] - route[i][0]) * t,
          route[i][1] + (route[i + 1][1] - route[i][1]) * t,
        ];
      }
      accumulated += seg;
    }
    return route[route.length - 1] as [number, number];
  }

  private routeLength(route: number[][]): number {
    let len = 0;
    for (let i = 0; i < route.length - 1; i++) {
      len += this.segmentDistance(route[i], route[i + 1]);
    }
    return len;
  }

  private segmentDistance(a: number[], b: number[]): number {
    const [lng1, lat1] = a;
    const [lng2, lat2] = b;
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(sinLat ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * sinLng ** 2), Math.sqrt(1 - (sinLat ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * sinLng ** 2)));
  }
}
