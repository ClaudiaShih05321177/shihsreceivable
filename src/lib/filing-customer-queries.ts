import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { compareCustomerCode } from "@/lib/customer-sort";
import type { FilingCustomer } from "@/lib/filing-customers";

export const filingCustomersQuery = queryOptions({
  queryKey: ["filing_customers"],
  queryFn: async () => {
    const all: FilingCustomer[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.rpc("filing_customer_directory").range(from, from + 999);
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) return all.sort((a, b) => compareCustomerCode(a.customer_code, b.customer_code, a.name, b.name));
    }
  },
});