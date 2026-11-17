import { compareCustomerCode } from "@/lib/customer-sort";
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { permissionsFor } from "@/lib/permissions";
import type { BonusData } from "@/lib/bonuses";
import { CUSTOMER_SELECT } from "@/lib/customer-fields";
import { allocateCredits } from "@/lib/credits";

export type Customer = Omit<Database["public"]["Tables"]["customers"]["Row"], "annual_extra_rate"> & { annual_extra_rate?: number | null };
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
export type Invoice = InvoiceRow & {
  customer: Pick<Customer, "id" | "name" | "customer_code"> | null;
  payments: Payment[];
  credit_applied?: number;
  credit_used?: number;
};
export type AppRole = Database["public"]["Enums"]["app_role"];

const INVOICE_SELECT = "*, customer:customers(id, name, customer_code), payments(*)";

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
      staffCode: (profile.data?.staff_code as string | null | undefined) ?? null,
      mustChangePassword: user.app_metadata?.["must_change_password"] === true,
      ...permissionsFor(roleList),
    };
  },
});

export const customersQuery = queryOptions({
  queryKey: ["customers"],
  queryFn: async () => {
    const { data, error } = await supabase.from("customers").select(CUSTOMER_SELECT).is("archived_at", null).order("name");
    if (error) throw error;
    data.sort((a, b) => compareCustomerCode(a.customer_code, b.customer_code, a.name, b.name));
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

async function fetchInvoices() {
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
      if (data.length < 1000) return allocateCredits(all);
    }
}

export const invoicesQuery = queryOptions({
  queryKey: ["invoices"],
  queryFn: fetchInvoices,
});

export const invoiceQuery = (id: string) =>
  queryOptions({
    queryKey: ["invoices", id],
    queryFn: async () => {
      const invoices = await fetchInvoices();
      return invoices.find((invoice) => invoice.id === id) ?? null;
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

export type FilingRow = Database["public"]["Tables"]["filings"]["Row"];
export type Filing = Omit<FilingRow, "service_fee"> & { service_fee?: number; customer_code?: string | null; customer: Pick<Customer, "id" | "name" | "customer_code"> | null };

/** 工商代辦費只有管理員可讀（經由管理員檢查的資料庫函式）。 */
export const filingServiceFeesQuery = queryOptions({
  queryKey: ["filings", "service_fees"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("filing_service_fees");
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((r) => [r.filing_id, Number(r.service_fee) || 0])) as Record<string, number>;
  },
});

export const filingsQuery = queryOptions({
  queryKey: ["filings"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("filings")
      .select("id, customer_id, case_type, stage, filed_date, approved_date, advance_fee, stamp_fee, invoice_id, notes, created_by, created_at, updated_at, company_name, route, tax_filed_date, tax_approved_date, customer_code, special_authority, special_filed_date, special_approved_date, change_detail, suspended_period, customer:customers(id, name, customer_code)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    // 同仁可能看不到案件客戶的完整資料，名稱與代碼另由資料庫函式提供。
    const { data: names, error: namesError } = await supabase.rpc("filing_customer_names");
    if (namesError) throw namesError;
    const byId = new Map((names ?? []).map((n) => [n.customer_id, n]));
    return (data ?? []).map((f) => {
      const n = f.customer_id ? byId.get(f.customer_id) : undefined;
      return !n ? f : { ...f, customer: { id: n.customer_id, name: n.name, customer_code: n.customer_code || f.customer?.customer_code || f.customer_code } };
    }) as unknown as Filing[];
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

export type BankTransaction = Database["public"]["Tables"]["bank_transactions"]["Row"];

export const bankTransactionsQuery = queryOptions({
  queryKey: ["bank_transactions"],
  queryFn: async () => {
    const { data, error } = await supabase.from("bank_transactions").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export type FactoryRegistration = Database["public"]["Tables"]["factory_registrations"]["Row"];

export const factoryRegistrationsQuery = queryOptions({
  queryKey: ["factory_registrations"],
  queryFn: async () => {
    const { data, error } = await supabase.from("factory_registrations").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});
