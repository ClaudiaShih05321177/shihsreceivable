import { describe, expect, it } from "vitest";
import { CUSTOMER_SELECT } from "./customer-fields";

describe("shared customer data permissions", () => {
  it("never requests the private annual bonus percentage for ordinary customer reads", () => {
    expect(CUSTOMER_SELECT.split(",")).not.toContain("annual_extra_rate");
    expect(CUSTOMER_SELECT).not.toContain("*");
    expect(CUSTOMER_SELECT.split(",")).toContain("bookkeeping_fee");
  });
});