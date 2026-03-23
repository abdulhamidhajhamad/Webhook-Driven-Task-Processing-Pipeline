import { describe, expect, test } from "vitest";
import { amountFilterAction } from "../../actions/amount-filter.action";

describe("amountFilterAction", () => {
  test("returns not filtered when amountInUSD is above minAmount", async () => {
    const payload = { amountInUSD: 150 };
    const config = { minAmount: 100 };
    const result = await amountFilterAction.execute(payload, config);
    expect(result.filtered).toBeFalsy();
    expect(result.data).toEqual(payload);
  });

  test("returns not filtered when amount is above minAmount", async () => {
    const payload = { amount: 200 };
    const config = { minAmount: 100 };
    const result = await amountFilterAction.execute(payload, config);
    expect(result.filtered).toBeFalsy();
    expect(result.data).toEqual(payload);
  });

  test("returns filtered when amountInUSD is below minAmount", async () => {
    const payload = { amountInUSD: 50 };
    const config = { minAmount: 100 };
    const result = await amountFilterAction.execute(payload, config);
    expect(result.filtered).toBeTruthy();
    expect(result.filterReason).toBe("Amount 50 is below the minimum threshold of 100");
  });

  test("throws error if amount is missing", async () => {
    const payload = { otherField: "test" };
    const config = {};
    await expect(amountFilterAction.execute(payload, config)).rejects.toThrow("amountInUSD or amount field is required for amount filter");
  });
});
