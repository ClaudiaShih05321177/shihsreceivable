import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { compareCustomerCode } from "@/lib/customer-sort";

export const factoryCustomersQuery = queryOptions({
  queryKey: ["factory_customers"],
  queryFn: async () => {
    const { data, error } = await supabase.from("factory_customers").select("*");
    if (error) throw error;
    return data.sort((a, b) => compareCustomerCode(a.customer_code, b.customer_code, a.name, b.name));
  },
});