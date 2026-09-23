import { ChecklistEntityType } from './checklist.entity';

export interface CreateChecklistDto {
  name: string;
  entityType: ChecklistEntityType;
  entityId: number;
  isChecked?: boolean;
  assigneeId?: number | null;
}

export interface UpdateChecklistDto {
  name?: string;
  isChecked?: boolean;
  assigneeId?: number | null;
}
