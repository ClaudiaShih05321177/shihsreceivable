import { describe, expect, it } from "vitest";
import { matchCustomer, matchFactoryByName } from "./customer-match";

describe("customer name matching", () => {
  const customers = [
    { name: "精密聚合股份有限公司", tax_id: "12345678", customer_code: "CF01" },
    { name: "同名有限公司", tax_id: "11111111", customer_code: "CF02" },
    { name: "同名有限公司", tax_id: "22222222", customer_code: "CF03" },
  ];
  it("brings in the existing customer code by company name", () => {
    expect(matchCustomer(customers, " 精密聚合股份有限公司 ", "")?.customer_code).toBe("CF01");
  });
  it("does not pick an arbitrary customer with the same name", () => {
    expect(matchCustomer(customers, "同名有限公司", "")).toBeUndefined();
    expect(matchCustomer(customers, "同名有限公司", "22222222")?.customer_code).toBe("CF03");
  });
});
describe("matchFactoryByName", () => {
  const list = [{ name: "思達科技股份有限公司", code: "CF60" }, { name: "思達科技股份有限公司 東廠", code: "CF60-2" }];
  it("同公司多廠時依廠名對到分廠", () => {
    expect(matchFactoryByName(list, "思達科技股份有限公司東廠")?.code).toBe("CF60-2");
    expect(matchFactoryByName(list, "思達科技股份有限公司")?.code).toBe("CF60");
  });
});
