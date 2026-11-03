import { DiscountStrategy } from './discount.strategy.js';

export class FixedDiscountStrategy implements DiscountStrategy {
  calculate(price: number, discountValue: number): number {
    return price - discountValue;
  }
}
