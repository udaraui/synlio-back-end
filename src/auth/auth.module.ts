import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './local.strategy';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { JwtStrategy } from './jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user-management/user/user.module';
import { CompanyModule } from '../company-management/company/company.module';
import { UserCompanyPrivilegeView } from '../user-management/user/user-company-privilege-view/user-company-privilege.entity';
import { UserPrivilegeView } from '../user-management/user/user-privilege-view/user-privilege.entity';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    UserModule,
    CompanyModule,
    RedisModule,
    TypeOrmModule.forFeature([UserCompanyPrivilegeView, UserPrivilegeView]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
