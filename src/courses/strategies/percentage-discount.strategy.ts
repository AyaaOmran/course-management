import { DiscountStrategy } from './discount.strategy.js';

export class PercentageDiscountStrategy implements DiscountStrategy {
  calculate(price: number, discountValue: number): number {
    return price - (price * discountValue / 100);
  }
}
