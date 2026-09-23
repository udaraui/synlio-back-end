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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { AlertRuleService } from './space-alert-rule.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';

@ApiTags('alert-rule')
@Controller('alert-rule')
@UseGuards(JwtAuthGuard)
export class AlertRuleController {
  constructor(private readonly alertRuleService: AlertRuleService) {}

  /** GET /alert-rule/space/:spaceType/:spaceId — list all rules for a space */
  @ApiOperation({ summary: 'List all alert rules for a space' })
  // @AuthorizationPermissions('107')
  @Get('space/:spaceType/:spaceId')
  findBySpace(
    @Param('spaceType') spaceType: string,
    @Param('spaceId', ParseIntPipe) spaceId: number,
  ) {
    return this.alertRuleService.findBySpace(spaceType, spaceId);
  }

  /** GET /alert-rule/users/search — search users for @mention */
  @ApiOperation({ summary: 'Search users for @mention in rule dialog' })
  // @AuthorizationPermissions('107')
  @Get('users/search')
  searchUsers(
    @Query('q') query: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.alertRuleService.searchUsers(
      query ?? '',
      companyId ? Number(companyId) : undefined,
    );
  }

  /** GET /alert-rule/users/by-ids — resolve full user info for a list of IDs */
  @ApiOperation({ summary: 'Fetch users by IDs (for rule editing)' })
  // @AuthorizationPermissions('107')
  @Get('users/by-ids')
  getUsersByIds(@Query('ids') ids: string) {
    const idList = ids ? ids.split(',').map(Number).filter(Boolean) : [];
    return this.alertRuleService.getUsersByIds(idList);
  }

  /** GET /alert-rule/:id — get single rule */
  @ApiOperation({ summary: 'Get a single alert rule' })
  // @AuthorizationPermissions('107')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.alertRuleService.findOne(id);
  }

  /** POST /alert-rule — create a rule */
  @ApiOperation({ summary: 'Create an alert rule' })
  // @AuthorizationPermissions('107')
  @Post()
  create(@Body() dto: CreateAlertRuleDto, @Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.alertRuleService.create(dto, req.user);
  }

  /** PATCH /alert-rule/:id — update a rule */
  @ApiOperation({ summary: 'Update an alert rule' })
  // @AuthorizationPermissions('107')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAlertRuleDto,
    @Request() req: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.alertRuleService.update(id, dto, req.user);
  }

  /** PATCH /alert-rule/:id/toggle — flip isActive */
  @ApiOperation({ summary: 'Toggle a rule active/inactive' })
  // @AuthorizationPermissions('107')
  @Patch(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.alertRuleService.toggle(id, req.user);
  }

  /** DELETE /alert-rule/:id — delete a rule */
  @ApiOperation({ summary: 'Delete an alert rule' })
  // @AuthorizationPermissions('107')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.alertRuleService.remove(id);
  }
}
