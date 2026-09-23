import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { EmailService } from './email.service';
import { CreateEmailDto, UpdateEmailDto } from './dto/email.dto';

@ApiTags('Email')
@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly commonService: CommonDbOperationService,
  ) {}

  // ------------------------------------------------------------------ //
  //  Search / list
  // ------------------------------------------------------------------ //

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Post('search')
  @ApiOperation({ summary: 'Search email records with filters and pagination' })
  search(
    @Body() query: QueryParam,
  ): Promise<{ total: number; data: object[] }> {
    return this.commonService.search('email', query);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Get()
  @ApiOperation({ summary: 'Get all email records' })
  findAll() {
    return this.emailService.findAll();
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Get('company/:companyId')
  @ApiOperation({ summary: 'Get all email records for a company' })
  findByCompany(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.emailService.findByCompany(companyId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all email records for a user' })
  findByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.emailService.findByUser(userId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Get(':id')
  @ApiOperation({ summary: 'Get a single email record by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.emailService.findOne(id);
  }

  // ------------------------------------------------------------------ //
  //  Create
  // ------------------------------------------------------------------ //

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('55', '56', '103', '104')
  @Post()
  @ApiOperation({ summary: 'Create a new email record' })
  create(@Body() dto: CreateEmailDto, @Request() req: any) {
    return this.emailService.create(dto, req.user);
  }

  // ------------------------------------------------------------------ //
  //  Update
  // ------------------------------------------------------------------ //

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('55', '56', '103', '104')
  @Put(':id')
  @ApiOperation({ summary: 'Update an email record' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmailDto,
    @Request() req: any,
  ) {
    return this.emailService.update(id, dto, req.user);
  }

  // ------------------------------------------------------------------ //
  //  Delete
  // ------------------------------------------------------------------ //

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('55', '56', '103', '104')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an email record and its attachments' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.emailService.delete(id);
  }
}
