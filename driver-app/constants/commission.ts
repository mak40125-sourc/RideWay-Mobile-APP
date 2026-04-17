export const COMMISSION_PERCENTAGE = 10;
export const COMMISSION_MINIMUM = 20;
export const COMMISSION_MAXIMUM = 50;

export const calculateCommission = (fare: number): number => {
  const commission = (fare * COMMISSION_PERCENTAGE) / 100;
  return Math.min(Math.max(commission, COMMISSION_MINIMUM), COMMISSION_MAXIMUM);
};