import type { RupeeAmount } from "./types";

export function toPaise(amount: RupeeAmount): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid money amount: ${amount}`);
  }

  return Math.round(amount * 100);
}

export function fromPaise(paise: number): RupeeAmount {
  return paise / 100;
}

export function roundMoney(amount: RupeeAmount): RupeeAmount {
  return fromPaise(toPaise(amount));
}

export function addMoney(...amounts: RupeeAmount[]): RupeeAmount {
  return fromPaise(amounts.reduce((total, amount) => total + toPaise(amount), 0));
}

export function sumMoney(amounts: RupeeAmount[]): RupeeAmount {
  return addMoney(...amounts);
}

export function taxAmount(taxableValue: RupeeAmount, ratePercent: number): RupeeAmount {
  if (!Number.isFinite(ratePercent)) {
    throw new Error(`Invalid GST rate: ${ratePercent}`);
  }

  const taxablePaise = toPaise(taxableValue);
  const rateMicros = Math.round(ratePercent * 1_000_000);
  const taxPaise = Math.round((taxablePaise * rateMicros) / 100_000_000);

  return fromPaise(taxPaise);
}

