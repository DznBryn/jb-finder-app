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
