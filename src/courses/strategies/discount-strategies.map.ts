
import { DiscountType } from '../entities/course.entity.js';
import { DiscountStrategy } from './discount.strategy.js';
import { NoDiscountStrategy } from './no-discount.strategy.js';
import { PercentageDiscountStrategy } from './percentage-discount.strategy.js';
import { FixedDiscountStrategy } from './fixed-discount.strategy.js';

export const discountStrategies: Record<DiscountType, DiscountStrategy> = {
  [DiscountType.NONE]: new NoDiscountStrategy(),
  [DiscountType.PERCENTAGE]: new PercentageDiscountStrategy(),
  [DiscountType.FIXED]: new FixedDiscountStrategy(),
};
