# Bump lib-worker in All Dependent Repos

Update all repos inside `/Users/alex/ec2code/finopsbricks/` that depend on `@fob/lib-worker` to the current version of this package.

## Step 1: Get Current Version

Read `package.json` in the current working directory and extract the `version` field. This is the target version.

## Step 2: Find Dependent Repos

Run:
```bash
grep -r "@fob/lib-worker" /Users/alex/ec2code/finopsbricks/ --include="package.json" -l 2>/dev/null | grep -v node_modules
```

Exclude:
- The lib-worker package itself (`lib/lib-worker/package.json`)

## Step 3: Show Current State

For each dependent repo found, show the current `@fob/lib-worker` value in their `package.json`. Present a summary table of what will change before proceeding.

Ask the user to confirm before making any changes.

## Step 4: Update Each Repo

For each dependent repo (run in parallel):

1. **Update package.json** — set `@fob/lib-worker` to `"github:finopsbricks/lib-worker#v{VERSION}"`

2. **Force re-resolve the lock file** — run:
   ```bash
   npm install @fob/lib-worker@github:finopsbricks/lib-worker#v{VERSION}
   ```
   This ensures `package-lock.json` resolves to the correct commit, not a cached one.

3. **Verify** the lock file now contains `"version": "{VERSION}"` for `node_modules/@fob/lib-worker`

## Step 5: Commit and Push Each Repo

For each dependent repo (run in parallel):

```bash
git add package.json package-lock.json
git commit -m "chore: bump @fob/lib-worker to v{VERSION}"
git push
```

## Step 6: Summary

Report results in a table:

| Repo | Previous Version | New Version | Status |
|------|-----------------|-------------|--------|
| ...  | ...             | ...         | pushed / failed |

If any repo failed, report the error clearly.
