import { Controller, Get, Post, Body, Patch, Query, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SimulationService } from './simulation.service';

@ApiTags('Simulation')
@ApiBearerAuth()
@Controller('simulation')
export class SimulationController {
  constructor(private simulationService: SimulationService) {}

  @Public()
  @Get('status')
  getStatus() {
    return this.simulationService.getStatus();
  }

  @Patch('toggle')
  async toggle(@Req() req) {
    if (req.user?.hospitalId != null) {
      throw new ForbiddenException('Only super admin can toggle simulation mode');
    }
    return this.simulationService.toggle();
  }

  @Post('assign')
  assign(@Body() dto: { alertId: string }) {
    return this.simulationService.assignAlert(dto.alertId);
  }

  @Public()
  @Post('public-alert')
  createPublicAlert(@Body() dto: { latitude: number; longitude: number }) {
    return this.simulationService.createPublicAlert(dto.latitude, dto.longitude);
  }

  @Public()
  @Post('routes')
  saveRoute(@Body() dto: { alertId: string; ambulanceId: string; route: number[][]; duration: number; distance: number }) {
    return this.simulationService.saveRoute(dto.alertId, dto.ambulanceId, dto.route, dto.duration, dto.distance);
  }

  @Public()
  @Post('cancel')
  cancelAlert(@Body() dto: { alertId: string }) {
    return this.simulationService.cancelAlert(dto.alertId);
  }

  @Public()
  @Post('start-return')
  startReturn(@Body() dto: { alertId: string }) {
    return this.simulationService.startReturn(dto.alertId);
  }

  @Public()
  @Get('positions')
  @ApiQuery({ name: 'hospitalId', required: false })
  getPositions(@Query('hospitalId') hospitalId?: string) {
    return this.simulationService.getPositions(hospitalId);
  }

  @Post('optimize')
  @ApiQuery({ name: 'hospitalId', required: false })
  optimize(@Body() dto: { hospitalId?: string }) {
    return this.simulationService.batchAssignWithSimplex(dto.hospitalId);
  }
}
