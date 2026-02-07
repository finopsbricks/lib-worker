# Template Helpers

Built-in helper functions available in all EJS templates.

## Available Helpers

| Helper | Purpose | Example Output |
|--------|---------|----------------|
| `formatAmount(n)` | Financial formatting (Indian locale) | `1,23,456.78` |
| `formatDate(d, style)` | Date formatting | `2024-01-15` or `January 15, 2024` |
| `formatPercent(ratio)` | Percentage | `85.50%` |
| `formatNumber(n)` | Number formatting | `1,234` |

## Usage in Templates

```markdown
# Report for <%= formatDate(date, 'long') %>

**Balance:** <%= formatAmount(closing_balance) %>

| Date | Amount |
|------|--------|
<% for (const row of data) { %>
| <%= formatDate(row.date, 'short') %> | <%= formatAmount(row.amount) %> |
<% } %>
```

## Note on formatAmount

Divides by 1000 (converts from storage format to display format).

## Related Notes

- [two-layer-templates.md](/docs/architecture/two-layer-templates.md)
- [calculate-daily-balances.md](/docs/architecture/calculate-daily-balances.md)
