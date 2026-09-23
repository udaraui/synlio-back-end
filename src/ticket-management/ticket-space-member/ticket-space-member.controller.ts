import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TicketSpaceMemberService } from './ticket-space-member.service';
import {
  CreateTicketSpaceMemberDto,
  UpdateTicketSpaceMemberDto,
  ResponseTicketSpaceMemberDto,
} from './dto/ticket-space-member.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { CommonDbOperationService } from 'src/common/common-db-operation/common-db-operation.service';
import { QueryParam } from 'src/common/common-db-operation/common-db-operation-query-param.dto';

@Controller('ticket-space')
export class TicketSpaceMemberController {
  constructor(
    private readonly ticketSpaceMemberService: TicketSpaceMemberService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('100')
  @Post('/permissions/search')
  async search(
    @Body() item: QueryParam,
  ): Promise<{ total: number; data: object[] }> {
    return this.commonDbOperationService.search('ticket_space_member', item);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('100')
  @Get(':id/permissions')
  getTicketSpacePermissions(
    @Param('id') ticketSpaceId: number,
  ): Promise<ResponseTicketSpaceMemberDto[]> {
    return this.ticketSpaceMemberService.getTicketSpacePermissions(
      ticketSpaceId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('98')
  @Post(':id/permissions')
  addPermissionToTicketSpace(
    @Param('id') ticketSpaceId: number,
    @Body() createDto: CreateTicketSpaceMemberDto,
    @Request() req,
  ): Promise<ResponseTicketSpaceMemberDto> {
    return this.ticketSpaceMemberService.addPermissionToTicketSpace(
      ticketSpaceId,
      createDto,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('98')
  @Post(':id/permissions/bulk')
  addBulkPermissionsToTicketSpace(
    @Param('id') ticketSpaceId: number,
    @Body() createDtos: CreateTicketSpaceMemberDto[],
    @Request() req,
  ): Promise<ResponseTicketSpaceMemberDto[]> {
    return this.ticketSpaceMemberService.addBulkPermissionsToTicketSpace(
      ticketSpaceId,
      createDtos,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('98')
  @Put(':id/permissions/:permissionId')
  updatePermission(
    @Param('id') ticketSpaceId: number,
    @Param('permissionId') permissionId: number,
    @Body() updateDto: UpdateTicketSpaceMemberDto,
    @Request() req,
  ): Promise<ResponseTicketSpaceMemberDto> {
    return this.ticketSpaceMemberService.updatePermission(
      ticketSpaceId,
      permissionId,
      updateDto,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('98')
  @Delete(':id/permissions/:permissionId')
  removePermission(
    @Param('id') ticketSpaceId: number,
    @Param('permissionId') permissionId: number,
  ): Promise<{ message: string }> {
    return this.ticketSpaceMemberService.removePermission(
      ticketSpaceId,
      permissionId,
    );
  }
}
