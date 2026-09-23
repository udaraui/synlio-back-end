import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { Public } from '../../auth/public.decorator';

@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Public()
  @Get()
  findAll() {
    return this.currencyService.findAll();
  }
}
