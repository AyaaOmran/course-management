import { ArgumentsHost, Catch, ConflictException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';

const PG_UNIQUE_VIOLATION = '23505';

@Catch(QueryFailedError)
export class UniqueViolationFilter extends BaseExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const code =
      (exception as any).driverError?.code ?? (exception as any).code;

    if (code === PG_UNIQUE_VIOLATION) {
      return super.catch(
        new ConflictException('Resource already exists'),
        host,
      );
    }

    return super.catch(exception, host);
  }
}