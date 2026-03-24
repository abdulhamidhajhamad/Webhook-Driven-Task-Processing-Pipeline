import { fullNameAction } from './full-name.action';
import { currencyConverterAction } from './currency-converter.action';
import { amountFilterAction } from './amount-filter.action';
import { ActionResult } from '../core/types';

export type ActionHandler = {
  execute(
    payload: Record<string, unknown>,
    config: Record<string, unknown>
  ): Promise<ActionResult>;
};

export const actions: Record<string, ActionHandler> = {
  full_name: fullNameAction,
  currency_converter: currencyConverterAction,
  amount_filter: amountFilterAction,
};