import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserConfigService } from './user-config.service';
import {
  UpdateUserConfigDto,
  ResponseUserConfigDto,
} from './dto/user-config.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';

@ApiTags('User Config')
@Controller('user-config')
@UseGuards(JwtAuthGuard)
export class UserConfigController {
  constructor(private readonly userConfigService: UserConfigService) {}

  @Get(':userId')
  @ApiOperation({ summary: 'Get user configuration by user ID' })
  @ApiResponse({
    status: 200,
    description: 'User configuration retrieved',
    type: ResponseUserConfigDto,
  })
  @ApiResponse({ status: 404, description: 'User configuration not found' })
  async getUserConfig(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<ResponseUserConfigDto> {
    return await this.userConfigService.getUserConfig(userId);
  }

  @Put(':userId')
  @ApiOperation({ summary: 'Create or update user configuration' })
  @ApiResponse({
    status: 200,
    description: 'User configuration updated',
    type: ResponseUserConfigDto,
  })
  async createOrUpdateUserConfig(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() updateDto: UpdateUserConfigDto,
    @Request() req,
  ): Promise<ResponseUserConfigDto> {
    return await this.userConfigService.createOrUpdateUserConfig(
      userId,
      updateDto,
      req.user,
    );
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Delete user configuration' })
  @ApiResponse({
    status: 200,
    description: 'User configuration deleted',
  })
  @ApiResponse({ status: 404, description: 'User configuration not found' })
  async deleteUserConfig(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<{ message: string }> {
    await this.userConfigService.deleteUserConfig(userId);
    return { message: 'User configuration deleted' };
  }
}
