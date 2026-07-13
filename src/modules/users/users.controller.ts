import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../shared/interfaces';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  @ApiQuery({ name: 'hospitalId', required: false })
  findAll(@Query('hospitalId') hospitalId?: string, @Request() req?) {
    const effectiveHospitalId = req.user.hospitalId ?? hospitalId;
    return this.usersService.findAll(effectiveHospitalId);
  }

  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateUserDto, @Request() req) {
    return this.usersService.create(dto, req.user.hospitalId);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req) {
    return this.usersService.update(id, dto, req.user.hospitalId);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.usersService.remove(id, req.user.hospitalId);
  }

  @Post(':id/change-password')
  changePassword(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(id, req.user.id, req.user.role, dto);
  }
}
