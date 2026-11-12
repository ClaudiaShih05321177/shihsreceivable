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

- Bonus rules are tested in src/lib/bonuses.ts; bonus rows are fetched only through the admin-checked SECURITY INVOKER database RPC, with a role-gated page and navigation. Why: bonus data must not be returned to ordinary members.

- Receivables business rules (status, overdue, aging, fee totals, ROC dates) live in `src/lib/receivables.ts` with tests in `src/lib/receivables.test.ts`; UI must call these helpers instead of re-deriving. Why: one tested source of truth for money logic.
- Data access goes through the browser Supabase client with RLS (`src/lib/queries.ts` queryOptions + route loaders); no server functions needed. Why: team-shared data is fully guarded by `is_member()` policies.
- Access model: first sign-up becomes admin via the `handle_new_user` trigger; later users have no role (pending) until an admin grants one on /team. Why: financial data must not be visible to arbitrary sign-ups.
- Permissions are derived from database roles through `src/lib/permissions.ts`; RLS permits members to read ledger data and insert invoices, while customer writes, invoice edits/deletes, payments and role management require admin. Why: UI and direct data access must enforce the same permission boundary.
- Signed-in pages live under `src/routes/_authenticated/_shell/` (shell layout shows the pending-approval screen for users without a role). Why: one place for nav and membership gating.
- Invoice fee breakdown is stored as `invoices.items` jsonb keyed by fee name; `amount` is saved as the items total. Why: mirrors the user's ledger columns without a column per fee.
- Invoice creation uses tested collection-month and fee helpers from `receivables.ts`; editing preserves saved amounts and manual overrides. Why: billing defaults must not silently rewrite existing financial records.
- Office letterhead and bank details for 請款單 live in OFFICE in src/lib/billing.ts; batch invoice creation and prior-balance logic are tested there. Why: one source for statement content.
- Fee-field display names live in `FEE_LABELS` in `src/lib/fee-labels.ts` (code, not a database table); screens render them through `feeLabel()` / `visibleFeeItems()`, never the raw fee key. Why: the user edits names by asking in chat, and a rename must never rewrite stored amounts or tax grouping.
