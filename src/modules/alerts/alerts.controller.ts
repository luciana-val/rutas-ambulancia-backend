import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { CreateAlertDto, UpdateAlertDto } from './dto';
import { AlertStatus } from '../../shared/interfaces';

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Post()
  create(@Body() dto: CreateAlertDto, @Request() req) {
    return this.alertsService.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'hospitalId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: AlertStatus, isArray: true })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('hospitalId') hospitalId?: string,
    @Query('status') status?: string | string[],
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
  ) {
    const statusArr = typeof status === 'string' ? [status] : status;
    return this.alertsService.findAll({ hospitalId, status: statusArr, dateFrom, dateTo, search });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.alertsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAlertDto) {
    return this.alertsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.alertsService.remove(id);
  }
}
