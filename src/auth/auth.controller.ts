import { Controller, Post, Body, Req, HttpCode, HttpStatus, UseGuards} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './decorators/public.decorator.js';
import type { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('register')
    register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
    }

    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto);
    } 
    
    @UseGuards(JwtAuthGuard)
    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    logout(@Req() req: Request) {
    return this.authService.logout(req.user as {
        sub: number;
        role: string;
    });
    }

}