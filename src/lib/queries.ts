import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { permissionsFor } from "@/lib/permissions";
import type { BonusData } from "@/lib/bonuses";
import { CUSTOMER_SELECT } from "@/lib/customer-fields";

export type Customer = Omit<Database["public"]["Tables"]["customers"]["Row"], "annual_extra_rate"> & { annual_extra_rate?: number | null };
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
export type Invoice = InvoiceRow & {
  customer: Pick<Customer, "id" | "name"> | null;
  payments: Payment[];
};
export type AppRole = Database["public"]["Enums"]["app_role"];

const INVOICE_SELECT = "*, customer:customers(id, name), payments(*)";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("尚未登入");
    const user = data.user;
    const [profile, roles] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    if (profile.error) throw profile.error;
    if (roles.error) throw roles.error;
    const roleList = (roles.data ?? []).map((r) => r.role);
    return {
      id: user.id,
      email: user.email ?? "",
      displayName: profile.data?.display_name ?? user.email ?? "",
      roles: roleList,
      ...permissionsFor(roleList),
    };
  },
});

export const customersQuery = queryOptions({
  queryKey: ["customers"],
  queryFn: async () => {
    const { data, error } = await supabase.from("customers").select(CUSTOMER_SELECT).order("name");
    if (error) throw error;
    const rates = await customerRates();
    return data.map((c): Customer => rates ? { ...c, annual_extra_rate: rates.get(c.id) ?? null } : c);
  },
});

async function customerRates(id?: string) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw authError ?? new Error("尚未登入");
  const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
  if (error) throw error;
  if (!permissionsFor((roles ?? []).map((r) => r.role)).canManageBonusRates) return null;
  const result = await supabase.rpc("customer_bonus_rates", id ? { _customer_id: id } : {});
  if (result.error) throw result.error;
  return new Map(result.data.map((r) => [r.customer_id, r.annual_extra_rate]));
}

export const bonusesQuery = queryOptions({
  queryKey: ["bonuses"],
  queryFn: async (): Promise<BonusData> => {
    const { data, error } = await supabase.rpc("bookkeeper_bonus_data");
    if (error) throw error;
    return data as unknown as BonusData;
  },
});

export const invoicesQuery = queryOptions({
  queryKey: ["invoices"],
  queryFn: async () => {
    // The backend returns at most 1000 rows per request, so read in pages.
    const all: Invoice[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("invoices")
        .select(INVOICE_SELECT)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("id")
        .range(from, from + 999);
      if (error) throw error;
      all.push(...(data as unknown as Invoice[]));
      if (data.length < 1000) return all;
    }
  },
});

export const invoiceQuery = (id: string) =>
  queryOptions({
    queryKey: ["invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(INVOICE_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Invoice | null;
    },
  });

export const customerQuery = (id: string) =>
  queryOptions({
    queryKey: ["customers", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select(CUSTOMER_SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const rates = await customerRates(id);
      return rates ? { ...data, annual_extra_rate: rates.get(id) ?? null } : data;
    },
  });

export const teamQuery = queryOptions({
  queryKey: ["team"],
  queryFn: async () => {
    const [profiles, roles] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (profiles.error) throw profiles.error;
    if (roles.error) throw roles.error;
    return (profiles.data ?? []).map((p) => ({
      ...p,
      roles: (roles.data ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
  },
});

export type TaxFiling = Database["public"]["Tables"]["tax_filings"]["Row"];

export const taxFilingsQuery = queryOptions({
  queryKey: ["tax_filings"],
  queryFn: async () => {
    const all: TaxFiling[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("tax_filings").select("*").order("id").range(from, from + 999);
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) return all;
    }
  },
});
