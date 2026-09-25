import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.gurard';
import { FilterTemplateService } from './filter-template.service';
import {
  CreateFilterTemplateDto,
  ShareFilterTemplateDto,
  UpdateFilterTemplateDto,
} from './dto/filter-template.dto';
import { FilterTemplateType } from './filter-template.entity';

@Controller('filter-templates')
@UseGuards(JwtAuthGuard)
export class FilterTemplateController {
  constructor(private readonly filterTemplateService: FilterTemplateService) {}

  private getAuthUser(req: any) {
    const raw = req.headers?.['x-selected-company'];
    const parsed = raw ? parseInt(raw as string, 10) : NaN;
    const activeCompanyId = !isNaN(parsed) && parsed !== 0 ? parsed : null;
    return {
      ...req.user,
      activeCompanyId,
    };
  }

  @Post()
  create(@Body() dto: CreateFilterTemplateDto, @Request() req: any) {
    return this.filterTemplateService.create(dto, this.getAuthUser(req));
  }

  @Get()
  findAll(
    @Query('type') type: FilterTemplateType,
    @Request() req: any,
  ) {
    const filterType = type || FilterTemplateType.TICKET;
    return this.filterTemplateService.findAll(filterType, this.getAuthUser(req));
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFilterTemplateDto,
    @Request() req: any,
  ) {
    return this.filterTemplateService.update(id, dto, this.getAuthUser(req));
  }

  @Post(':id/share')
  share(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ShareFilterTemplateDto,
    @Request() req: any,
  ) {
    return this.filterTemplateService.share(id, dto, this.getAuthUser(req));
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.filterTemplateService.delete(id, this.getAuthUser(req));
  }
}
