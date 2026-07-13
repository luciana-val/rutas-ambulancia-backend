import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { AmbulancesService } from './ambulances.service';
import { CreateAmbulanceDto, UpdateAmbulanceDto, UpdateLocationDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../shared/interfaces';

const storage = diskStorage({
  destination: join(process.cwd(), 'uploads', 'ambulance-plates'),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
  },
});

@ApiTags('Ambulances')
@ApiBearerAuth()
@Controller('ambulances')
export class AmbulancesController {
  constructor(private ambulancesService: AmbulancesService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { storage }))
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateAmbulanceDto,
    @Request() req,
  ) {
    this.validateHospitalAccess(req, dto.hospitalId);
    if (file) dto.platePhoto = file.filename;
    return this.ambulancesService.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'hospitalId', required: false })
  findAll(@Query('hospitalId') hospitalId?: string, @Request() req?) {
    return this.ambulancesService.findAll(hospitalId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ambulancesService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { storage }))
  update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateAmbulanceDto,
    @Request() req,
  ) {
    if (file) dto.platePhoto = file.filename;
    return this.ambulancesService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ambulancesService.remove(id);
  }

  @Patch(':id/location')
  updateLocation(@Param('id') id: string, @Body() dto: UpdateLocationDto, @Request() req) {
    return this.ambulancesService.updateLocation(id, dto, req.user.id);
  }

  private validateHospitalAccess(req, targetHospitalId: string) {
    if (req.user.hospitalId && req.user.hospitalId !== targetHospitalId) {
      throw new Error('You can only manage ambulances in your hospital');
    }
  }
}
