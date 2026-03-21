type Operator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';

export const filterAction = {
  async execute(
    payload: Record<string, unknown>,
    config: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const field = config.field as string;
    const operator = config.operator as Operator;
    const value = config.value;
    const fieldValue = payload[field];

    const passes = filterAction.evaluate(fieldValue, operator, value);
    if (!passes) return null;

    return payload;
  },

  evaluate(fieldValue: unknown, operator: Operator, value: unknown): boolean {
    switch (operator) {
      case 'eq':       return fieldValue === value;
      case 'neq':      return fieldValue !== value;
      case 'gt':       return (fieldValue as number) > (value as number);
      case 'lt':       return (fieldValue as number) < (value as number);
      case 'gte':      return (fieldValue as number) >= (value as number);
      case 'lte':      return (fieldValue as number) <= (value as number);
      case 'contains': return String(fieldValue).includes(String(value));
      default:         return false;
    }
  },
};