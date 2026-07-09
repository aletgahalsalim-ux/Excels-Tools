import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import type { AuthResponseDto } from '@afdip/shared';
import { AuthService } from './auth.service';
import { Public } from './jwt-auth.guard';
import { AuditService } from '../audit/audit.service';

class RegisterDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsNotEmpty()
  name!: string;

  @IsNotEmpty()
  organizationName!: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const result = await this.auth.register(dto);
    await this.audit.log(result.user.id, 'register', 'user', result.user.id);
    return result;
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const result = await this.auth.login(dto.email, dto.password);
    await this.audit.log(result.user.id, 'login', 'user', result.user.id);
    return result;
  }
}
