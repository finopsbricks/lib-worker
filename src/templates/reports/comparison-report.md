# Statement Comparison Report

**Statement ID:** <%= statement_id %>
**File:** <%= file_name || 'N/A' %>
**Account:** <%= account_id %>
**Period:** <%= period_start %> to <%= period_end %>
**Generated:** <%= new Date().toISOString() %>

## Comparison Summary

| Metric | Count |
|--------|------:|
| Matched | <%= comparison.matched.length %> days |
| Mismatched | <%= comparison.mismatched.length %> days |
| Missing in App | <%= comparison.missing_in_target.length %> days |
| Extra in App | <%= comparison.extra_in_target.length %> days |

<% if (comparison.matched.length > 0 && comparison.mismatched.length === 0 && comparison.missing_in_target.length === 0) { %>
> **ALL MATCHED** - Statement fully reconciled with app transactions

<% } %>
<% if (comparison.mismatched.length > 0) { %>
## Mismatches

| Date | Field | Statement | App Txns | Diff |
|-----:|-------|----------:|--------:|-----:|
<% for (const m of comparison.mismatched) { %>
<% if (m.diff.opening_balance !== 0) { %>
| <%= m.date %> | opening | <%= formatAmount(m.source.opening_balance) %> | <%= formatAmount(m.target.opening_balance) %> | <%= formatAmount(m.diff.opening_balance) %> |
<% } %>
<% if (m.diff.inflow !== 0) { %>
| <%= m.date %> | inflow | <%= formatAmount(m.source.inflow) %> | <%= formatAmount(m.target.inflow) %> | <%= formatAmount(m.diff.inflow) %> |
<% } %>
<% if (m.diff.outflow !== 0) { %>
| <%= m.date %> | outflow | <%= formatAmount(m.source.outflow) %> | <%= formatAmount(m.target.outflow) %> | <%= formatAmount(m.diff.outflow) %> |
<% } %>
<% if (m.diff.closing_balance !== 0) { %>
| <%= m.date %> | closing | <%= formatAmount(m.source.closing_balance) %> | <%= formatAmount(m.target.closing_balance) %> | <%= formatAmount(m.diff.closing_balance) %> |
<% } %>
<% } %>

<% } %>
<% if (comparison.missing_in_target.length > 0) { %>
## Missing in App Transactions

| Date | Opening | Inflow | Outflow | Closing | Txns |
|-----:|--------:|-------:|--------:|--------:|-----:|
<% for (const m of comparison.missing_in_target) { %>
<% const d = m.source; %>
| <%= m.date %> | <%= formatAmount(d.opening_balance) %> | <%= formatAmount(d.inflow) %> | <%= formatAmount(d.outflow) %> | <%= formatAmount(d.closing_balance) %> | <%= d.transaction_count %> |
<% } %>

<% } %>
<% if (comparison.extra_in_target.length > 0) { %>
## Extra in App Transactions

| Date | Opening | Inflow | Outflow | Closing | Txns |
|-----:|--------:|-------:|--------:|--------:|-----:|
<% for (const e of comparison.extra_in_target) { %>
<% const d = e.target; %>
| <%= e.date %> | <%= formatAmount(d.opening_balance) %> | <%= formatAmount(d.inflow) %> | <%= formatAmount(d.outflow) %> | <%= formatAmount(d.closing_balance) %> | <%= d.transaction_count %> |
<% } %>

<% } %>
