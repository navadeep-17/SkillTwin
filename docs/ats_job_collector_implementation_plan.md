# SkillTwin Employer Job Collector — implementation plan

## Goal and scope

Extend classic **Explore Careers** with first-party collection from selected employers'
**public job postings APIs**. Employer jobs are ranked against the signed-in learner's
goal and existing skill profile; Jobicy remains a fallback. Do not claim verified hiring
eligibility or universal coverage. No application automation, private ATS endpoints,
CAPTCHA bypass, or harvesting personal applicant data.

Official provider specifications:
- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html)
- [Lever Postings API](https://github.com/lever/postings-api)
- [Ashby Public Postings API](https://developers.ashbyhq.com/docs/public-job-posting-api)

## Phases and acceptance gates

| Stage | Scope | Gate |
| --- | --- | --- |
| 1. Adapters | Greenhouse, Lever, Ashby; reviewed board registry; bounded HTTPS GETs; normalize public postings | Fixture tests for every provider, malformed input, URL allowlist, feed truncation |
| 2. Persistence | Additive PostgreSQL tables and RLS; idempotent upsert; two successful missing scans before inactive; audit outcomes | Migration applies in isolated staging and independent repeated runs agree |
| 3. Refresh | Protected POST endpoint and GitHub Actions cron every 2 hours; retries and per-board failure isolation | Secret validation; no writes from anonymous users; failed boards never close jobs |
| 4. Explore | Read only employer catalog; title/skill/region matching; provider URLs and actual published-vs-first-seen date labels; Jobicy fallback | Authenticated browser checks at 390px and desktop, source provenance, no matches |
| 5. Production | Verify boards on staging and review ingestion metrics, then migrate production, set cron secrets and merge/release | Health checks, sample source links, fresh sync audit rows, data volume and rate limits |

## Curated initial registry

The code registry in `lib/jobs/source-registry.ts` begins with:
Greenhouse: Redwood Software, DoorDash India, Truveta, Zenoti.
Lever: Acceldata, Saviynt.
Ashby: Astronomer.

These organizations' public board identifiers were individually checked against
published job-board pages. This is an **initial curated set**, not the full jobs market.
Board content can change and no particular open role is guaranteed. Expanding this
list requires reviewing each public board's identity and recruitment-site usage rules.

## Collection contract

- Fixed official API hosts and checked company board tokens; never fetch arbitrary user URLs.
- GET only, no cookies, redirects, authentication or application submissions. Each call has
  a nine-second timeout and 6 MB response bound. Lever pagination is capped and a
  truncated feed is rejected, not considered a complete snapshot.
- Normalize title, company, location, work arrangement, employment type, description,
  canonical HTTPS posting URL and publication/last-updated timestamps if explicitly supplied.
- Store `first_seen_at` and `last_seen_at` independently of upstream publication dates.
- Dedupe per provider/board/external_id, with a separate title+company UI dedupe.
- Mark missing only when a board returns a successful complete snapshot. Require
  two consecutive successful absences before marking a posting inactive.
- Keep a per-board sync audit; failure never closes old jobs. Skip zero/invalid responses.

## Schedule and secrets

1. Apply `supabase/migrations/0031_ats_job_collector.sql` to **staging** and
   verify row-level security and rollback compatibility. Do not reset user data.
2. With a staging instance, configure a private `JOB_COLLECTOR_SECRET` of at
   least 32 random characters and invoke `POST /api/internal/jobs/collect`
   with `x-job-collector-secret`. Review response success and sync-run rows.
3. Apply the migration to production after staging approval and deploy the code.
4. Set the **same** secret as `JOB_COLLECTOR_SECRET` on the Railway web service
   and `SKILLTWIN_JOB_COLLECTOR_SECRET` in GitHub Actions repository secrets.
   Never commit it or print it in logs. The scheduled workflow gracefully does
   nothing when the GitHub secret is absent.
5. Verify first sync, the actual employer links and a second sync (upsert stability).
   The GitHub Actions schedule runs every two hours; it is not instantaneous.
6. If providers are unavailable or a migration is missing, Explore keeps using
   Jobicy and logs a read error; user data is never modified.

## Limits and follow-up

- Sites with custom career pages need explicit permission/review and separate
  scrapers; this MVP does **not** silently crawl arbitrary HTML.
- Public APIs can change or rate-limit requests. Use conservative request cadence.
- Region matching uses text heuristics (including a short list of Indian cities).
  Location text never guarantees India work authorization or remote eligibility.
- Future: richer structured location metadata, stronger entry-level/graduate
  eligibility filtering, saved vacancies, 24h closure alerts, collector observability,
  explicit canonical cross-board company dedupe, and feedback on match quality.
