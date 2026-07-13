import { Controller, Get, Post, Body, Patch, Param, Delete, Request, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { HospitalsService } from './hospitals.service';
import { CreateHospitalDto, UpdateHospitalDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../shared/interfaces';

@ApiTags('Hospitals')
@ApiBearerAuth()
@Controller('hospitals')
export class HospitalsController {
  constructor(private hospitalsService: HospitalsService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateHospitalDto, @Request() req) {
    const isSuperAdmin = req.user.role === UserRole.ADMIN && req.user.hospitalId === null;
    if (!isSuperAdmin) {
      throw new Error('Only super admin can create hospitals');
    }
    return this.hospitalsService.create(dto);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    return this.hospitalsService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hospitalsService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateHospitalDto, @Request() req) {
    const hospital = await this.hospitalsService.findOne(id);
    const isSuperAdmin = req.user.role === UserRole.ADMIN && req.user.hospitalId === null;
    const isHospitalAdmin = req.user.role === UserRole.ADMIN && req.user.hospitalId === id;
    if (!isSuperAdmin && !isHospitalAdmin) {
      throw new Error('Not authorized to update this hospital');
    }
    return this.hospitalsService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    const isSuperAdmin = req.user.role === UserRole.ADMIN && req.user.hospitalId === null;
    if (!isSuperAdmin) {
      throw new Error('Only super admin can delete hospitals');
    }
    return this.hospitalsService.remove(id);
  }
}
