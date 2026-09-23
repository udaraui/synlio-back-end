import {
  Controller,
  Req,
  Post,
  UseGuards,
  Body,
  Put,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { SkillLevelService } from './skill-level.service';
import {
  CreateSkillLevelDto,
  UpdateSkillLevelDto,
} from './dto/skill-level.dto';
import { CommonDbOperationService } from '../../../common/common-db-operation/common-db-operation.service';
import { JwtAuthGuard } from '../../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../../common/common-db-operation/common-db-operation-query-param.dto';

@Controller('skill-level')
export class SkillLevelController {
  constructor(
    private readonly commonDbOperationService: CommonDbOperationService,
    private readonly skillLevelService: SkillLevelService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('17')
  @Post('/search')
  async searchLevels(
    @Body() item: QueryParam,
    @Req() req: any,
  ): Promise<{ total: number; data: object[] }> {
    return this.commonDbOperationService.search('SkillLevel', item);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('18')
  @Post()
  createSkillLevel(@Body() data: CreateSkillLevelDto, @Req() req: any) {
    return this.skillLevelService.createSkillLevel(data, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('19')
  @Put('/:id')
  updateSkillLevel(
    @Param('id') id: number,
    @Body() data: UpdateSkillLevelDto,
    @Req() req: any,
  ) {
    return this.skillLevelService.updateSkillLevel(id, data, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('19')
  @Patch('/:id')
  disableSkillLevel(@Param('id') id: number, @Req() req: any) {
    return this.skillLevelService.disableSkillLevel(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('20')
  @Delete('/:id')
  deleteSkillLevel(@Param('id') id: number, @Req() req: any) {
    return this.skillLevelService.deleteSkillLevel(id, req.user);
  }
}
