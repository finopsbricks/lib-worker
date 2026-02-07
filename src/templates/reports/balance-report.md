# <%= title %>

**Generated:** <%= new Date().toISOString() %>
<% if (metadata.file_name) { %>
**File:** <%= metadata.file_name %>
<% } %>
<% if (metadata.period_start && metadata.period_end) { %>
**Period:** <%= metadata.period_start %> to <%= metadata.period_end %>
<% } %>
<% if (metadata.opening_balance !== undefined) { %>
**Opening Balance:** <%= formatAmount(metadata.opening_balance) %>
**Balance Source:** <%= metadata.balance_source || 'computed' %>
<% } %>

| Date | Opening | Inflow | Outflow | Closing | Txns |
|-----:|--------:|-------:|--------:|--------:|-----:|
<% const dates = Object.keys(balances).sort(); %>
<% for (const date of dates) { %>
<% const d = balances[date]; %>
| <%= date %> | <%= formatAmount(d.opening_balance) %> | <%= d.inflow ? formatAmount(d.inflow) : '-' %> | <%= d.outflow ? formatAmount(d.outflow) : '-' %> | <%= formatAmount(d.closing_balance) %> | <%= d.transaction_count || '-' %> |
<% } %>
