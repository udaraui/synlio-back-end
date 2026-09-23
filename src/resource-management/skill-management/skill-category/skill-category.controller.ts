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
import { SkillCategoryService } from './skill-category.service';
import {
  CreateSkillCategoryDto,
  UpdateSkillCategoryDto,
} from './dto/skill-category.dto';
import { CommonDbOperationService } from '../../../common/common-db-operation/common-db-operation.service';
import { JwtAuthGuard } from '../../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../../common/common-db-operation/common-db-operation-query-param.dto';

@Controller('skill-category')
export class SkillCategoryController {
  constructor(
    private readonly skillCategoryService: SkillCategoryService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('17')
  @Post('/search')
  async searchCategories(
    @Body() item: QueryParam,
    @Req() req: any,
  ): Promise<{ total: number; data: object[] }> {
    return this.commonDbOperationService.search('SkillCategories', item);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('18')
  @Post()
  create(
    @Body() createSkillCategoryDto: CreateSkillCategoryDto,
    @Req() req: any,
  ) {
    return this.skillCategoryService.create(createSkillCategoryDto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('19')
  @Put('/:id')
  update(
    @Param('id') id: number,
    @Body() updateSkillCategoryDto: UpdateSkillCategoryDto,
    @Req() req: any,
  ) {
    return this.skillCategoryService.update(
      id,
      updateSkillCategoryDto,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('19')
  @Patch('/:id')
  disable(@Param('id') id: number, @Req() req: any) {
    return this.skillCategoryService.disable(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('20')
  @Delete('/:id')
  delete(@Param('id') id: number, @Req() req: any) {
    return this.skillCategoryService.delete(id, req.user);
  }
}
