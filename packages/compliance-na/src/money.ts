export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function addMoney(...values: number[]): number {
  return roundMoney(values.reduce((sum, value) => sum + value, 0));
}

export function percentOf(amount: number, ratePercent: number): number {
  return roundMoney(amount * (ratePercent / 100));
}
