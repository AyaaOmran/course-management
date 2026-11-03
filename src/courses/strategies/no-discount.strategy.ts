import { DiscountStrategy } from './discount.strategy.js';

export class NoDiscountStrategy implements DiscountStrategy {
  calculate(price: number, discountValue: number): number {
    return price;
  }
}
