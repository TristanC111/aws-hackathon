# RefugeAid Backend

Node.js 20 Lambda backend for RefugeAid: PDF upload → Textract → Translate → Bedrock pipeline that produces plain-language explanations and form-fill suggestions in 75+ languages.

## Layout

```
backend/
├── lambdas/
│   ├── upload/              POST /upload          (multipart PDF → S3 + new session)
│   ├── analyze/             POST /analyze         (Textract + Translate + Bedrock)
│   ├── form-suggest/        POST /form-suggest    (per-field AI suggestion)
│   ├── generate-draft/      POST /generate-draft  (compile answers → PDF)
│   ├── session/             GET  /session/{id}    + POST /session/save
│   └── legal-aid/           GET  /legal-aid       (static org directory)
├── prompts/                 Bedrock system prompts (.txt — easy to tweak)
├── shared/                  Reusable AWS SDK + helpers
├── infrastructure/setup.md  Step-by-step AWS deployment guide
├── build.mjs                esbuild bundler — produces dist/<name>.zip per Lambda
└── package.json
```

## Build

```bash
npm install
npm run build
# → one zip per Lambda in dist/
```

## Deploy

See [infrastructure/setup.md](infrastructure/setup.md) for the full AWS walkthrough.

Quick re-deploy after a code change:

```bash
npm run build
for n in upload analyze form-suggest generate-draft session legal-aid; do
  aws lambda update-function-code \
    --function-name "refugeaid-$n" \
    --zip-file "fileb://dist/${n}.zip"
done
```

## Environment variables (set on each Lambda)

| Var | Default | Purpose |
|---|---|---|
| `S3_BUCKET` | `refugeaid-docs` | Where uploads + drafts live |
| `DYNAMO_TABLE` | `refugeaid-sessions` | Session state store |
| `BEDROCK_MODEL_ID` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Bedrock model |
| `AWS_REGION` | `us-east-1` | Auto-set by Lambda |
