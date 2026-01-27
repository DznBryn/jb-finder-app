# Resume Parsing Evaluation

Run the evaluation script to see how resume parsing performs on labeled examples.

```bash
cd backend
python -m app.eval.run_resume_eval
```

The script prints per-case metrics and averages for:
- skills recall
- titles recall
- seniority match
- years of experience match

Update `resume_eval_cases.json` to add more labeled test cases.
