import { describe, expect, test, vi, afterEach } from "vitest";
import { currencyConverterAction } from "../../actions/currency-converter.action";

describe("currencyConverterAction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns original payload if currency is USD", async () => {
    const payload = { amount: 100, currency: "USD" };
    const config = {};
    const result = await currencyConverterAction.execute(payload, config);
    expect(result.filtered).toBeFalsy();
    expect(result.data?.amountInUSD).toBe(100);
    expect(result.data?.originalCurrency).toBe("USD");
  });

  test("converts non-USD currency correctly", async () => {
    const payload = { customAmount: 110, customCur: "EUR" };
    const config = { amountField: "customAmount", currencyField: "customCur" };
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { EUR: 0.9, JPY: 110 } }),
    });

    const result = await currencyConverterAction.execute(payload, config);
    
    expect(result.filtered).toBeFalsy();
    expect(result.data?.amountInUSD).toBe(122.22); // 110 / 0.9 = 122.22
    expect(result.data?.originalCurrency).toBe("EUR");
  });

  test("throws error if amount is missing", async () => {
    const payload = { currency: "USD" };
    const config = {};
    await expect(currencyConverterAction.execute(payload, config)).rejects.toThrow("amount field is required for currency conversion");
  });

  test("throws error if currency is missing", async () => {
    const payload = { amount: 100 };
    const config = {};
    await expect(currencyConverterAction.execute(payload, config)).rejects.toThrow("currency field is required for currency conversion");
  });

  test("throws error if currency is unsupported by API", async () => {
    const payload = { amount: 100, currency: "XYZ" };
    const config = {};
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { EUR: 0.9 } }),
    });

    await expect(currencyConverterAction.execute(payload, config)).rejects.toThrow("Unsupported currency: XYZ");
  });
});
