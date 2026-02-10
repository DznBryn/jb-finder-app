# Company Seeds & Validation

## Seed file
`companies_seed.json` contains company metadata and ATS tokens.

## Validate tokens
```bash
cd backend
python -m app.schedulers.validate_companies
```
This writes `companies_seed.valid.json` with invalid tokens removed.

## Load seeds into DB
```bash
cd backend
python -m app.schedulers.load_companies

python -m app.schedulers.run_refresh
```

## Clean up expired resume sessions
Expired `resume_sessions` rows (where `expires_at` is in the past) are never auto-deleted by the app; they are only ignored when loading a session. To remove them from the DB, run periodically (e.g. daily cron) or on demand:

```bash
cd backend
python -m app.schedulers.cleanup_expired_sessions
```

Or call the internal API (requires `X-Internal-API-Key`):

```bash
curl -X POST "http://localhost:8000/api/internal/cleanup-expired-sessions" \
  -H "X-Internal-API-Key: YOUR_INTERNAL_API_KEY"
```
