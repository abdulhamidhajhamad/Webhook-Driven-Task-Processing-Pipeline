import { describe, expect, test } from "vitest";
import { fullNameAction } from "./full-name.action";

describe("fullNameAction", () => {
  test("concat firstName and lastName correctly", async () => {
    const payload = { firstName: "John", lastName: "Doe" };
    const config = {};
    const result = await fullNameAction.execute(payload, config);
    expect(result.filtered).toBeFalsy();
    expect(result.data).toEqual({ ...payload, fullName: "John Doe" });
  });

  test("uses custom config fields for resolving names", async () => {
    const payload = { first: "Alice", last: "Smith" };
    const config = { firstNameField: "first", lastNameField: "last" };
    const result = await fullNameAction.execute(payload, config);
    expect(result.data).toEqual({ ...payload, fullName: "Alice Smith" });
  });

  test("throws error if firstName or lastName is missing", async () => {
    const payload = { firstName: "OnlyFirst" };
    const config = {};
    await expect(fullNameAction.execute(payload, config)).rejects.toThrow("firstName and lastName are required for fullName action");
  });
});
