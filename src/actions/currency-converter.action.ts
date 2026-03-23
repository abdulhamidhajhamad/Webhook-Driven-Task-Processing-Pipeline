import { ActionResult } from '../core/types';

interface RateCache {
  rates: Record<string, number>;
  cachedAt: number;
}

let rateCache: RateCache | null = null;
const CACHE_TTL = 60 * 60 * 1000;

async function getRates(): Promise<Record<string, number>> {
  const now = Date.now();

  if (rateCache && now - rateCache.cachedAt < CACHE_TTL) {
    return rateCache.rates;
  }

  const response = await fetch(
    'https://api.exchangerate-api.com/v4/latest/USD',
    { signal: AbortSignal.timeout(5000) }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch exchange rates');
  }

  const data = await response.json() as { rates: Record<string, number> };

  rateCache = {
    rates: data.rates,
    cachedAt: now,
  };

  return data.rates;
}

export const currencyConverterAction = {
  async execute(
    payload: Record<string, unknown>,
    config: Record<string, unknown>
  ): Promise<ActionResult> {
    const amount = payload[config.amountField as string ?? 'amount'] as number;
    const fromCurrency = (payload[config.currencyField as string ?? 'currency'] as string)?.toUpperCase();

    if (amount === undefined || amount === null) {
      throw new Error('amount field is required for currency conversion');
    }

    if (!fromCurrency) {
      throw new Error('currency field is required for currency conversion');
    }

    if (fromCurrency === 'USD') {
      return {
        filtered: false,
        data: {
          ...payload,
          amountInUSD: amount,
          originalAmount: amount,
          originalCurrency: fromCurrency,
        }
      };
    }

    const rates = await getRates();
    const rate = rates[fromCurrency];

    if (!rate) {
      throw new Error(`Unsupported currency: ${fromCurrency}`);
    }

    const amountInUSD = parseFloat((amount / rate).toFixed(2));

    return {
      filtered: false,
      data: {
        ...payload,
        amountInUSD,
        originalAmount: amount,
        originalCurrency: fromCurrency,
      }
    };
  },
};
