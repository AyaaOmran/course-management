import { IsOptional } from 'class-validator';

export class RefreshDto {
    @IsOptional()
    refreshToken?: string;
}