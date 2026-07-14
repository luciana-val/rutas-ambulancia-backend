import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { SimulationRoute } from '../../entities/simulation-route.entity';
import { AmbulancesService } from '../ambulances/ambulances.service';
import { AlertsService } from '../alerts/alerts.service';
import { HospitalsService } from '../hospitals/hospitals.service';
import { AmbulanceStatus, AlertStatus } from '../../shared/interfaces';
import { SimplexSolver } from './simplex';

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
    private configService: ConfigService,
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

    await this.autoOptimize(alert.hospitalId, alertId);

    const updated = await this.alertsService.findOne(alertId);
    if (updated.status !== AlertStatus.ASSIGNED) {
      throw new BadRequestException('No hay ambulancias disponibles para asignar');
    }

    const ambulance = await this.ambulancesService.findOne(updated.ambulanceId!);
    return { ambulance };
  }

  async createPublicAlert(lat: number, lng: number) {
    const hospital = await this.hospitalsService.findNearestWithAmbulances(lat, lng);
    if (!hospital) throw new BadRequestException('[ERR-1] No hay ambulancias disponibles en ningún hospital cercano');

    const alert = await this.alertsService.create({
      hospitalId: hospital.id,
      latitude: lat,
      longitude: lng,
      description: 'Alerta de emergencia',
    });
    await this.alertsService.update(alert.id, { isSimulation: true });

    this.logger.log(`createPublicAlert: llamando autoOptimize para hospital ${hospital.id}`);
    await this.autoOptimize(hospital.id, alert.id);

    const updated = await this.alertsService.findOne(alert.id);
    this.logger.log(`createPublicAlert: alerta ${alert.id} status=${updated.status} ambulanceId=${updated.ambulanceId}`);
    if (updated.status !== AlertStatus.ASSIGNED || !updated.ambulanceId) {
      throw new BadRequestException('[ERR-2] No hay ambulancias disponibles (autoOptimize no asignó)');
    }

    const ambulance = await this.ambulancesService.findOne(updated.ambulanceId);

    return {
      alert: updated,
      ambulance: {
        id: ambulance.id,
        plate: ambulance.plate,
        latitude: ambulance.latitude,
        longitude: ambulance.longitude,
        driverName: ambulance.driver?.name ?? null,
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

  // ================================================================
  //  SIMPLEX + MAPBOX TRAFFIC OPTIMIZATION
  // ================================================================

  async buildTrafficTimeMatrix(
    ambulances: { id: string; latitude: number; longitude: number }[],
    alerts: { id: string; latitude: number; longitude: number }[],
  ): Promise<{ matrix: number[][]; method: 'mapbox' | 'haversine' }> {
    const m = ambulances.length;
    const n = alerts.length;
    const total = m + n;

    if (total === 0) return { matrix: [], method: 'haversine' };

    const token = this.configService.get('app.mapboxAccessToken');
    const profile = 'driving';
    const maxCoords = 25;

    if (token && total <= maxCoords) {
      try {
        const coords = [
          ...ambulances.map(a => `${a.longitude},${a.latitude}`),
          ...alerts.map(a => `${a.longitude},${a.latitude}`),
        ].join(';');

        const sources = Array.from({ length: m }, (_, i) => i).join(';');
        const destinations = Array.from({ length: n }, (_, i) => i + m).join(';');

        const res = await axios.get(
          `https://api.mapbox.com/directions-matrix/v1/mapbox/${profile}/${coords}`,
          {
            params: {
              access_token: token,
              sources,
              destinations,
              annotations: 'duration',
            },
            timeout: 10000,
          },
        );

        const durations = res.data.durations as number[][];
        const matrix: number[][] = [];
        for (let i = 0; i < m; i++) {
          matrix[i] = [];
          for (let j = 0; j < n; j++) {
            matrix[i][j] = durations[i]?.[j] ?? Infinity;
          }
        }
        return { matrix, method: 'mapbox' };
      } catch {
        this.logger.warn('Mapbox Matrix API falló, usando haversine');
      }
    }

    return { matrix: this.buildHaversineMatrix(ambulances, alerts), method: 'haversine' };
  }

  private buildHaversineMatrix(
    ambulances: { latitude: number; longitude: number }[],
    alerts: { latitude: number; longitude: number }[],
  ): number[][] {
    return ambulances.map(a =>
      alerts.map(al => this.haversine(a.latitude, a.longitude, al.latitude, al.longitude)),
    );
  }

  private async autoOptimize(hospitalId?: string, forceAlertId?: string): Promise<void> {
    this.logger.log(`autoOptimize iniciado para hospitalId=${hospitalId}, forceAlertId=${forceAlertId ?? 'ninguno'}`);

    const allAlerts = await this.alertsService.findAll({ hospitalId, status: [AlertStatus.PENDING] });
    const pendingAlerts = allAlerts.filter(a => a.status === AlertStatus.PENDING);
    this.logger.log(`autoOptimize: alertas pending encontradas: ${pendingAlerts.length}`);
    if (!pendingAlerts.length) { this.logger.warn('autoOptimize: sin alertas pending, retorna'); return; }

    const allAmbulances = await this.ambulancesService.findAll(hospitalId);
    const availableAmbulances = allAmbulances.filter(
      a => a.status === AmbulanceStatus.ACTIVE && a.latitude != null && a.longitude != null,
    );
    this.logger.log(`autoOptimize: ambulancias disponibles: ${availableAmbulances.length}`);
    this.logger.log(`autoOptimize: coord ambulancias: ${JSON.stringify(availableAmbulances.map(a => ({ id: a.id, lat: a.latitude, lng: a.longitude })))}`);
    this.logger.log(`autoOptimize: coord alertas: ${JSON.stringify(pendingAlerts.map(a => ({ id: a.id, lat: a.latitude, lng: a.longitude })))}`);
    if (!availableAmbulances.length) { this.logger.warn('autoOptimize: sin ambulancias disponibles, retorna'); return; }

    let m = availableAmbulances.length;
    let n = pendingAlerts.length;

    let alertsToAssign: typeof pendingAlerts;
    if (forceAlertId && pendingAlerts.some(a => a.id === forceAlertId)) {
      alertsToAssign = [pendingAlerts.find(a => a.id === forceAlertId)!];
      n = 1;
    } else if (n > m) {
      alertsToAssign = pendingAlerts
        .slice()
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(0, m);
      n = m;
    } else {
      alertsToAssign = pendingAlerts;
    }

    const { matrix, method } = await this.buildTrafficTimeMatrix(availableAmbulances, alertsToAssign);
    this.logger.log(`autoOptimize: matriz de costos (${m}x${n}) via ${method}: ${JSON.stringify(matrix)}`);

    const c: number[] = [];
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++)
        c.push(matrix[i][j]);

    const varCount = m * n;
    const A: number[][] = [];
    const b: number[] = [];
    const signs: ('≤' | '=')[] = [];

    for (let i = 0; i < m; i++) {
      const row = Array(varCount).fill(0);
      for (let j = 0; j < n; j++) row[i * n + j] = 1;
      A.push(row); b.push(1); signs.push('≤');
    }

    for (let j = 0; j < n; j++) {
      const row = Array(varCount).fill(0);
      for (let i = 0; i < m; i++) row[i * n + j] = 1;
      A.push(row); b.push(1); signs.push('=');
    }

    const solver = new SimplexSolver(c, A, b, signs);
    const result = solver.solve();
    this.logger.log(`autoOptimize: Simplex status=${result.status}, objValue=${result.objectiveValue}, solution=${JSON.stringify(result.solution)}`);

    if (result.status !== 'optimal') { this.logger.warn('autoOptimize: Simplex no retornó optimal, retorna'); return; }

    let assignedCount = 0;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (result.solution[i * n + j] > 0.5) {
          const ambulance = availableAmbulances[i];
          const alert = alertsToAssign[j];
          this.logger.log(`autoOptimize: asignando alert ${alert.id} -> ambulance ${ambulance.plate}`);
          await this.alertsService.update(alert.id, {
            status: AlertStatus.ASSIGNED,
            ambulanceId: ambulance.id,
          });
          await this.ambulancesService.update(ambulance.id, { status: AmbulanceStatus.BUSY });
          assignedCount++;
        }
      }
    }
    this.logger.log(`autoOptimize: completado, ${assignedCount} asignaciones realizadas`);
  }

  /**
   * Asigna múltiples alertas PENDING a ambulancias ACTIVE usando
   * el Método Simplex (Tableau de Dos Fases) con costos de Mapbox.
   */
  async batchAssignWithSimplex(hospitalId?: string) {
    const allAlerts = await this.alertsService.findAll({ hospitalId, status: [AlertStatus.PENDING] });
    const pendingAlerts = allAlerts.filter(a => a.status === AlertStatus.PENDING);
    if (!pendingAlerts.length) throw new BadRequestException('No hay alertas pendientes');

    const allAmbulances = await this.ambulancesService.findAll(hospitalId);
    const availableAmbulances = allAmbulances.filter(
      a => a.status === AmbulanceStatus.ACTIVE && a.latitude != null && a.longitude != null,
    );
    if (!availableAmbulances.length) throw new BadRequestException('No hay ambulancias disponibles');

    const m = availableAmbulances.length;
    const n = pendingAlerts.length;

    if (n > m) {
      throw new BadRequestException(
        `Hay ${n} alertas pero solo ${m} ambulancias. Resuelva manualmente o espere más ambulancias.`,
      );
    }

    const { matrix, method } = await this.buildTrafficTimeMatrix(availableAmbulances, pendingAlerts);

    // Flatten cost matrix: c[k] = matrix[i][j] where k = i*n + j
    const c: number[] = [];
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        c.push(matrix[i][j]);
      }
    }

    // Build LP
    const varCount = m * n;
    const constraintCount = m + n;
    const A: number[][] = [];
    const b: number[] = [];
    const signs: ('≤' | '=')[] = [];

    // m constraints: each ambulance assigned to at most 1 alert
    for (let i = 0; i < m; i++) {
      const row = Array(varCount).fill(0);
      for (let j = 0; j < n; j++) row[i * n + j] = 1;
      A.push(row);
      b.push(1);
      signs.push('≤');
    }

    // n constraints: each alert needs exactly 1 ambulance
    for (let j = 0; j < n; j++) {
      const row = Array(varCount).fill(0);
      for (let i = 0; i < m; i++) row[i * n + j] = 1;
      A.push(row);
      b.push(1);
      signs.push('=');
    }

    const solver = new SimplexSolver(c, A, b, signs);
    const result = solver.solve();

    if (result.status === 'infeasible') {
      throw new BadRequestException('El Simplex no encontró asignación factible');
    }

    // Apply assignments
    const assignments: {
      alertId: string; ambulanceId: string; plate: string;
      cost: number; alertNumber: number; driverName: string | null;
    }[] = [];

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        const val = result.solution[i * n + j];
        if (val > 0.5) {
          const ambulance = availableAmbulances[i];
          const alert = pendingAlerts[j];

          await this.alertsService.update(alert.id, {
            status: AlertStatus.ASSIGNED,
            ambulanceId: ambulance.id,
          });
          await this.ambulancesService.update(ambulance.id, { status: AmbulanceStatus.BUSY });

          assignments.push({
            alertId: alert.id,
            alertNumber: alert.alertNumber,
            ambulanceId: ambulance.id,
            plate: ambulance.plate,
            driverName: ambulance.driver?.name ?? null,
            cost: matrix[i][j],
          });
        }
      }
    }

    return {
      assignments,
      objectiveValue: result.objectiveValue,
      iterations: result.iterations,
      costMethod: method,
      costUnit: method === 'mapbox' ? 'seconds' : 'km',
      totalAssignments: assignments.length,
      pendingAlerts: n,
      availableAmbulances: m,
      tableaux: result.tableaux,
    };
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
