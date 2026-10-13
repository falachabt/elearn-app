# Agent Configuration

## CI‑wait rule
When a push is performed on `main` or any branch matching the pattern `kw*`, the agent must **wait for the associated GitHub Actions workflow to finish successfully** before considering the push operation complete.

The agent should:
1. Identify the latest workflow run triggered by the push (use `gh run list --branch <branch> --limit 1`).
2. Poll the run status (`gh run view <run-id> --json status,conclusion`) until `status` is `completed`.
3. Verify that `conclusion` is `success`. If the run fails, report the failure and abort further steps.
4. Only after a successful run, proceed with any post‑push actions (e.g., deployment, notifications).

This ensures that code is not merged or further actions taken until the CI pipeline passes.
## Run on kw branch
To launch the CI run on a `kw*` branch of `elearn-app`, use the GitHub CLI:
```sh
gh workflow run ci.yml --ref <kw-branch-name>
```
After triggering, the CI‑wait rule above will automatically poll the workflow until it completes successfully.
