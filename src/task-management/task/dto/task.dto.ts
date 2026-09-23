import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsArray,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { Severity } from '../../../common/severity/severity.entity';
import { Resource } from '../../../resource-management/resource/resource.entity';
import { Task } from '../task.entity';
import { TaskSpaceHierarchyLevelConfig } from '../../task-space-hierarchy-level/task-space-hierarchy-level-config.entity';

export class CreateTaskDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  taskSpaceId: number;

  @IsInt()
  @IsOptional()
  parentTaskId?: number;

  @IsObject()
  @IsOptional()
  parentTask?: Task;

  @IsInt()
  @IsOptional()
  statusId?: number;

  @IsInt()
  @IsOptional()
  severityId?: number;

  @IsObject()
  @IsOptional()
  severity?: Severity;

  @IsInt()
  @IsOptional()
  assigneeId?: number;

  @IsObject()
  @IsOptional()
  assignee?: Resource;

  @IsString()
  @IsOptional()
  assigneeSkill?: string;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  coAssigneeIds?: number[];

  @IsArray()
  @IsOptional()
  coAssignees?: Resource[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  memberIds?: number[];

  @IsArray()
  @IsOptional()
  members?: Resource[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  labelIds?: number[];

  @IsArray()
  @IsOptional()
  labels?: any[];

  @IsInt()
  @IsOptional()
  estimateEffort?: number;

  @IsInt()
  @IsOptional()
  actualEffort?: number;

  @IsInt()
  @IsOptional()
  progressPercentage?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsDateString()
  @IsOptional()
  completionDate?: string;

  @IsDateString()
  @IsOptional()
  actualStartDate?: string;

  @IsDateString()
  @IsOptional()
  actualEndDate?: string;

  @IsBoolean()
  @IsOptional()
  special?: boolean;

  @IsInt()
  @IsOptional()
  companyId?: number;

  @IsInt()
  @IsOptional()
  divisionId?: number;

  @IsInt()
  @IsOptional()
  hierarchyLevelConfigId?: number;

  @IsObject()
  @IsOptional()
  hierarchyLevel?: TaskSpaceHierarchyLevelConfig;

  @IsString()
  @IsOptional()
  hierarchyLevelName?: string;

  @IsString()
  @IsOptional()
  hierarchyLevelIcon?: string;

  @IsString()
  @IsOptional()
  hierarchyLevelColor?: string;

  @IsInt()
  @IsOptional()
  hierarchyLevelSequence?: number;

  // ── Denormalized Fields (read-only, returned in responses) ────────────
  @IsString()
  @IsOptional()
  taskSpaceName?: string;

  @IsString()
  @IsOptional()
  taskSpacePrefix?: string;

  @IsString()
  @IsOptional()
  statusName?: string;

  @IsString()
  @IsOptional()
  statusColor?: string;

  @IsString()
  @IsOptional()
  statusBase?: string;

  @IsString()
  @IsOptional()
  severityName?: string;

  @IsString()
  @IsOptional()
  severityColor?: string;

  @IsString()
  @IsOptional()
  assigneeName?: string;

  @IsString()
  @IsOptional()
  assigneeProfilePicUrl?: string;

  @IsString()
  @IsOptional()
  assigneeEmail?: string;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  taskSpaceId?: number;

  @IsInt()
  @IsOptional()
  parentTaskId?: number;

  @IsInt()
  @IsOptional()
  statusId?: number;

  @IsInt()
  @IsOptional()
  severityId?: number;

  @IsInt()
  @IsOptional()
  assigneeId?: number;

  @IsString()
  @IsOptional()
  assigneeSkill?: string;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  coAssigneeIds?: number[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  memberIds?: number[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  labelIds?: number[];

  @IsInt()
  @IsOptional()
  estimateEffort?: number;

  @IsInt()
  @IsOptional()
  actualEffort?: number;

  @IsInt()
  @IsOptional()
  progressPercentage?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsDateString()
  @IsOptional()
  completionDate?: string;

  @IsDateString()
  @IsOptional()
  actualStartDate?: string;

  @IsDateString()
  @IsOptional()
  actualEndDate?: string;

  @IsBoolean()
  @IsOptional()
  special?: boolean;

  @IsInt()
  @IsOptional()
  hierarchyLevelConfigId?: number;

  @IsString()
  @IsOptional()
  hierarchyLevelName?: string;

  @IsString()
  @IsOptional()
  hierarchyLevelIcon?: string;

  @IsString()
  @IsOptional()
  hierarchyLevelColor?: string;

  @IsInt()
  @IsOptional()
  hierarchyLevelSequence?: number;
}