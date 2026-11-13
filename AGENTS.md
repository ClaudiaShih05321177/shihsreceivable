<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Shared customer queries use an explicit public column list; bonus percentages are fetched only through an admin-checked security-definer RPC, with direct column SELECT revoked. Why: row-level customer sharing must not expose private bonus settings.

- Bonus rules are tested in src/lib/bonuses.ts; bonus rows come from the SECURITY INVOKER RPC bookkeeper_bonus_data, so RLS limits members to their own customers while admins see all and print per-staff sign-off sheets. Why: staff see only their own bonus.

- Receivables business rules (status, overdue, aging, fee totals, ROC dates) live in `src/lib/receivables.ts` with tests in `src/lib/receivables.test.ts`; UI must call these helpers instead of re-deriving. Why: one tested source of truth for money logic.
- Data access goes through the browser Supabase client with RLS (`src/lib/queries.ts` queryOptions + route loaders); no server functions needed. Why: team-shared data is fully guarded by `is_member()` policies.
- Access model: first sign-up becomes admin via the `handle_new_user` trigger; later users have no role (pending) until an admin grants one on /team. Why: financial data must not be visible to arbitrary sign-ups.
- Permissions are derived from database roles through `src/lib/permissions.ts`; RLS permits members to read ledger data, insert invoices and update their own (can_see_customer) customers, while customer deletes, invoice edits/deletes, payments and role management require admin. Why: UI and data access share one boundary.
- Signed-in pages live under `src/routes/_authenticated/_shell/` (shell layout shows the pending-approval screen for users without a role). Why: one place for nav and membership gating.
- Invoice fee breakdown is stored as `invoices.items` jsonb keyed by fee name; `amount` is saved as the items total. Why: mirrors the user's ledger columns without a column per fee.
- Invoice creation uses tested collection-month and fee helpers from `receivables.ts`; editing preserves saved amounts and manual overrides. Why: billing defaults must not silently rewrite existing financial records.
- Office letterhead and bank details for 請款單 live in OFFICE in src/lib/billing.ts; batch invoice creation and prior-balance logic are tested there. Why: one source for statement content.
- Fee-field display names live in `FEE_LABELS` in `src/lib/fee-labels.ts` (code, not a database table); screens render them through `feeLabel()` / `visibleFeeItems()`, never the raw fee key. Why: the user edits names by asking in chat, and a rename must never rewrite stored amounts or tax grouping.
- 工商進度表 lives in `public.filings` with route-dependent stages (經濟部+國稅局: 預查→送件→核准→國稅局送件→國稅局核准→結案; 只送國稅局 starts at 國稅局送件); new setups may have no customer (company_name) and must be linked before 結案立帳; rules in `src/lib/filings.ts` (tested). 結案立帳 merges 工商代辦費 (fee key displaying as 工商代辦費) plus custom 代墊規費/印章 items into the customer's bimonthly (odd-month) bookkeeping invoice, creating it with scheduled fees if missing, and links back via `filings.invoice_id`. `filings.service_fee` is column-revoked from members; admins read/write it only via admin-checked RPCs. Creating filings and 結案 (RPC close_filing) are limited to admin or CLOSER_STAFF_CODES (RLS insert policy + UI); other members view only; admins 立帳 separately. Members may create customers (tax-ID lookup); staff_code is derived from the first two letters of customer_code. Why: no double entry.
- 勤豐工商顧問 data lives in `public.factory_registrations` (progress + project receivable columns on one row); rules in `src/lib/factory.ts` (tested); the sidebar company switcher (`useCompany`, localStorage) only changes navigation. Why: project-style billing differs from the bimonthly ledger and must not mix with invoices.
- Tax-paid checkmarks for monthly groups (扣繳/二代健保) use `tax_filings.item` keys `項目#1`/`項目#2` from `splitTaxLines`; legacy unsplit keys still count for both months. Why: billed bimonthly but paid monthly.
- 勤豐 報價單／請款單 print page is `/factory-doc/$id?type=&stage=`; amounts come from tested `src/lib/factory-docs.ts` (KINFENG letterhead/bank there). Why: documents must match the AR row numbers.
- Team accounts are created by admins via admin-checked server functions in src/lib/team.functions.ts; public signup is disabled and app_metadata.must_change_password forces a first-login password change in the shell. Why: staff must not self-register.
- Non-admin members see only customers (and their invoices/payments/tax rows) whose staff code (customers.staff_code or first 2 letters of customer_code) matches profiles.staff_code, via `can_see_customer()` RLS; admins set codes through the admin-checked `set_staff_code` RPC (column not user-updatable). Why: each staff member sees only their own clients.

- Non-admin members may only open /invoices, /filings, /customers (canSeePage in src/lib/permissions.ts); the shell redirects other paths and hides nav and the company switcher. Why: staff only need receivables, filings and customers.
