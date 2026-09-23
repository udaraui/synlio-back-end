import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkillService } from './skill.service';
import { CreateSkillDto, UpdateSkillDto } from './dto/skill.dto';
import { CommonDbOperationService } from '../../../common/common-db-operation/common-db-operation.service';
import { JwtAuthGuard } from '../../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../../common/common-db-operation/common-db-operation-query-param.dto';
import { JwtStrategy } from '../../../auth/jwt.strategy';

@Controller('skill')
export class SkillController {
  constructor(
    private readonly skillService: SkillService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('17')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
    @Req() req: any,
  ): Promise<{ total: number; data: object[] }> {
    return this.commonDbOperationService.search('skill', item);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('18')
  @Post()
  createSkill(@Body() createSkillDto: CreateSkillDto, @Req() req: any) {
    return this.skillService.create(createSkillDto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('19')
  @Put('/:id')
  update(
    @Param('id') id: number,
    @Body() updateSkillDto: UpdateSkillDto,
    @Req() req: any,
  ) {
    return this.skillService.update(id, updateSkillDto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('19')
  @Patch('/:id')
  disable(@Param('id') id: number, @Req() req: any) {
    return this.skillService.disable(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('20')
  @Delete('/:id')
  delete(@Param('id') id: number, @Req() req: any) {
    return this.skillService.delete(id, req.user);
  }
}
