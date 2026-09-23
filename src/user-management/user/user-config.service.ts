import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserConfig } from './user-config.entity';
import {
  CreateUserConfigDto,
  UpdateUserConfigDto,
  ResponseUserConfigDto,
} from './dto/user-config.dto';

@Injectable()
export class UserConfigService {
  constructor(
    @InjectRepository(UserConfig)
    private userConfigRepository: Repository<UserConfig>,
  ) {}

  async getUserConfig(userId: number): Promise<ResponseUserConfigDto> {
    const config = await this.userConfigRepository.findOne({
      where: { userId },
    });

    if (!config) {
      throw new NotFoundException(
        `User configuration not found for user ID: ${userId}`,
      );
    }

    return config;
  }

  async createOrUpdateUserConfig(
    userId: number,
    updateDto: UpdateUserConfigDto,
    currentUser?: any,
  ): Promise<ResponseUserConfigDto> {
    // Check if config exists
    let config = await this.userConfigRepository.findOne({
      where: { userId },
    });

    if (config) {
      // Update existing config
      if (updateDto.theme !== undefined) {
        config.theme = updateDto.theme;
      }
      if (updateDto.viewPreference !== undefined) {
        config.viewPreference = updateDto.viewPreference;
      }
      if (updateDto.primaryColor !== undefined) {
        config.primaryColor = updateDto.primaryColor;
      }
      if (updateDto.sidebarColor !== undefined) {
        config.sidebarColor = updateDto.sidebarColor;
      }
      if (updateDto.filterPreference !== undefined) {
        config.filterPreference = {
          ...(config.filterPreference || {}),
          ...updateDto.filterPreference,
        };
      }
      if (updateDto.filterTemplates !== undefined) {
        config.filterTemplates = {
          ...(config.filterTemplates || {}),
          ...updateDto.filterTemplates,
        };
      }
      if (updateDto.quickActionConfig !== undefined) {
        config.quickActionConfig = updateDto.quickActionConfig;
      }
      config.updatedBy = currentUser?.email || currentUser?.userId?.toString();
    } else {
      // Create new config
      config = this.userConfigRepository.create({
        userId,
        theme: updateDto.theme || 'system',
        viewPreference: updateDto.viewPreference || null,
        primaryColor: updateDto.primaryColor || 'default',
        sidebarColor: updateDto.sidebarColor || 'default',
        filterPreference: updateDto.filterPreference || null,
        filterTemplates: updateDto.filterTemplates || null,
        quickActionConfig: updateDto.quickActionConfig || null,
        createdBy: currentUser?.email || currentUser?.userId?.toString(),
        updatedBy: currentUser?.email || currentUser?.userId?.toString(),
      });
    }

    return await this.userConfigRepository.save(config);
  }

  async deleteUserConfig(userId: number): Promise<void> {
    const config = await this.userConfigRepository.findOne({
      where: { userId },
    });

    if (!config) {
      throw new NotFoundException(
        `User configuration not found for user ID: ${userId}`,
      );
    }

    await this.userConfigRepository.remove(config);
  }
}
