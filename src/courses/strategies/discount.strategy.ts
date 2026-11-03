export interface DiscountStrategy {
  calculate(price: number, discountValue: number): number;
}
