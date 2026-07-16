# Audit specs — analytics pipeline (observability & recovery nuances)

> Specs / findings that belong in the audit trail, **not** in the main ops doc
> ([ANALYTICS.md](./ANALYTICS.md)). Keep `ANALYTICS.md` action-oriented; park edge behaviour here.

Branch context: `audit-michael-wybraniec` — related to « Reprise en cas d'échec ».

---

## SPEC-01 — Job 1 failure mode: throw, not `succes: false`

**Severity:** Low for ops recovery · Medium for observability / agentic tooling  
**Status:** Documented here only (not expanded in ANALYTICS.md)

### Fact

`1-charger-les-evenements.job.ts` never sets `erreur` and has no `catch` around the load path.
On failure it **throws**. `JobHandler.execute` then:

- does **not** persist a `SuiviJob`
- rethrows (APM / logs)

Contrast with job 2 (`2-enrichir-les-evenements.job.ts`), which `catch`es and returns `succes: false` → `SuiviJob` saved.

### Why it is not critical in ANALYTICS.md

Recovery is the same either way: check SuiviJob **or** logs/APM, then re-run
`TASK_NAME=CHARGER_EVENEMENTS_ANALYTICS`. The table wording « Job 1 échoue » remains correct.

### Spec / follow-up (optional code)

- Align job 1 with job 2: `catch` → return `SuiviJob` with `succes: false` (and still do not enqueue enrich on failure).
- Or document in agent metadata that job 1 success signal is « SuiviJob present + succes » vs « throw ».

### Code refs

- `src/application/jobs/analytics/1-charger-les-evenements.job.ts` — `handle()`
- `src/building-blocks/types/job-handler.ts` — `execute()` save only after `handle` returns

---

## SPEC-02 — Job 0 dump: `stderr` ⇒ `succes: false` while job 1 still runs

**Severity:** Low–medium for false alarms · Low for data path (job 1 still enqueued)  
**Status:** Short note already in ANALYTICS.md « Reprise » ; detail parked here

### Fact

`0-dump-for-analytics.job.ts`:

1. Runs `yarn run dump-restore-db` via `exec`
2. Any `stderr` → `erreur` set → returned `SuiviJob.succes === false`
3. **Always** `ajouterJob(CHARGER_EVENEMENTS_ANALYTICS)` afterward

CLI tools (`pg_dump` / `pg_restore` / script echoes) often write to stderr even when the dump is usable. So dump SuiviJob can look failed while the chain continues.

### Why it is not critical to expand further in ANALYTICS.md

Ops note already says: check dump SuiviJob before trusting the rest. Panic on dump `succes: false` alone would be the anti-pattern; the note is enough for the main doc.

### Spec / follow-up (optional code)

- Treat exit code of the script as success signal, not mere presence of stderr.
- Or only set `erreur` when the shell script exits non-zero (`exec` throws / `error` callback).
- Do **not** enqueue job 1 if dump truly failed (if product decides chain must stop).

### Code refs

- `src/application/jobs/analytics/0-dump-for-analytics.job.ts` — stderr → `erreur`, then unconditional `ajouterJob`
- `scripts/analytics/0_db_dump_restore.sh`

---

## Relation to ANALYTICS.md

| Audience | Where |
| --- | --- |
| On-call / Metabase « chiffre figé » | [ANALYTICS.md — Reprise en cas d'échec](./ANALYTICS.md#reprise-en-cas-déchec) |
| Audit / agentic / future hardening | This file |

Do not duplicate long playbooks here — only specs that would clutter the main pipeline doc.
