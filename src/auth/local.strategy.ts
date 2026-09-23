import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import {
  HttpStatus,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      // throw new UnauthorizedException();
      throw new HttpException(
        `User name or password invalid`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return user;
  }
}
