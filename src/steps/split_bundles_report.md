# <%= station %> — Split Bundle into Pages

**Status**: <%= status %>

<% if (status === 'split') { -%>
| Field | Value |
|-------|-------|
| Bundle | <%= bundle_name %> |
| Pages extracted | <%= page_count %> |
| Bundles remaining | <%= bundles_remaining %> |
| Station | `<%= station %>` |
| Output | `<%= station %>_output/<%= stem %>/_pages/` |
<% } else { -%>
No bundles pending in `<%= station %>_input` — <%= bundles_total %> bundle(s) already processed.
<% } -%>

---
*Work Record: <%= work_record_id %>*
