export const amountFilterAction = {
  async execute(
    payload: Record<string, unknown>,
    config: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const minAmount = (config.minAmount as number) ?? 100;
    const amountInUSD = payload.amountInUSD as number ?? payload.amount as number;

    if (amountInUSD === undefined || amountInUSD === null) {
      throw new Error('amountInUSD or amount field is required for amount filter');
    }

    if (amountInUSD < minAmount) {
      return null;
    }

    return payload;
  },
};