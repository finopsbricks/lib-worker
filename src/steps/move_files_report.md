# Transfer: <%= source_bin %> → <%= target_bin %>

**Timestamp**: <%= timestamp %>
**Mode**: <%= mode %>

| Metric | Count |
|--------|------:|
| Moved | <%= moved_count %> |
| Total Available | <%= total_available %> |

<% if (entries.length > 0) { -%>
## Entries Moved

| <%= mode === 'directories' ? 'Directory' : 'File' %> |
|------|
<% for (const e of entries) { -%>
| `<%= e %>` |
<% } -%>
<% } -%>

---
*Work Record: <%= work_record_id %>*
