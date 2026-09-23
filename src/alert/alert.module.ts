import { Module } from '@nestjs/common';
import { EmailController } from './email/email.controller';
import { EmailService } from './email/email.service';
import { NotificationController } from './notification/notification.controller';
import { NotificationService } from './notification/notification.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AlertRuleController } from './alert-rule/space-alert-rule.controller';
import { AlertRuleService } from './alert-rule/space-alert-rule.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [EmailController, NotificationController, AlertRuleController],
  providers: [EmailService, NotificationService, AlertRuleService],
  exports: [AlertRuleService, EmailService],
})
export class AlertModule {}
