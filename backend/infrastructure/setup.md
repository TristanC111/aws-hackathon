# RefugeAid — AWS Deployment Guide

This walks through everything needed to move the `backend/` code into AWS so the frontend can call it. Region: **us-east-1** throughout.

You will create:

1. An S3 bucket
2. A DynamoDB table
3. An IAM role for Lambda
4. Six Lambda functions
5. An API Gateway (HTTP API) that fronts them
6. Bedrock model access (one-time, in the console)

Total time: ~30–45 minutes the first time. Re-deploys take ~1 minute (just re-upload the zips).

---

## 0. Prerequisites

```bash
# Install (macOS)
brew install awscli node

# Configure
aws configure                       # use us-east-1
aws sts get-caller-identity         # confirm
```

You also need **Bedrock model access**. In the AWS Console → Bedrock → Model access → request access for **Anthropic Claude 3.5 Sonnet v2** (or whichever model ID you set as `BEDROCK_MODEL_ID`). This takes a few minutes to approve.

```bash
# Set these once for the rest of the guide
export AWS_REGION=us-east-1
export BUCKET=refugeaid-docs
export TABLE=refugeaid-sessions
export ROLE_NAME=refugeaid-lambda-role
export MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

---

## 1. Build the Lambda zips

```bash
cd backend
npm install
npm run build
# → dist/upload.zip, analyze.zip, form-suggest.zip,
#   generate-draft.zip, session.zip, legal-aid.zip
```

---

## 2. Create the S3 bucket

```bash
aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$AWS_REGION"

# Block public access (signed URLs handle downloads)
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# CORS so the frontend can upload directly if you ever switch to presigned PUT
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}'
```

---

## 3. Create the DynamoDB table

```bash
aws dynamodb create-table \
  --table-name "$TABLE" \
  --attribute-definitions AttributeName=sessionId,AttributeType=S \
  --key-schema AttributeName=sessionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$AWS_REGION"

# Wait for it
aws dynamodb wait table-exists --table-name "$TABLE"

# Enable TTL on the expiresAt column (24-hour session auto-cleanup)
aws dynamodb update-time-to-live \
  --table-name "$TABLE" \
  --time-to-live-specification "Enabled=true,AttributeName=expiresAt"
```

---

## 4. Create the IAM role

```bash
# Trust policy — Lambda can assume this role
cat > trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document file://trust.json

# Basic Lambda execution (CloudWatch logs)
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Inline policy for the rest of our services
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
cat > inline.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::${BUCKET}/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT}:table/${TABLE}"
    },
    {
      "Effect": "Allow",
      "Action": [
        "textract:DetectDocumentText",
        "textract:StartDocumentTextDetection",
        "textract:GetDocumentTextDetection"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["translate:TranslateText", "comprehend:DetectDominantLanguage"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:${AWS_REGION}::foundation-model/anthropic.*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name refugeaid-inline \
  --policy-document file://inline.json

# Wait a few seconds for IAM to propagate before creating Lambdas
sleep 10

export ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)
echo "Role: $ROLE_ARN"
```

---

## 5. Create the six Lambda functions

Same env vars on every function. The handler is `index.handler`. Runtime is `nodejs20.x`. The `analyze` function calls Textract+Translate+Bedrock so it needs more time and memory.

```bash
create_lambda () {
  local NAME=$1
  local TIMEOUT=$2
  local MEMORY=$3
  local FNAME="refugeaid-$NAME"

  aws lambda create-function \
    --function-name "$FNAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --timeout "$TIMEOUT" \
    --memory-size "$MEMORY" \
    --zip-file "fileb://dist/${NAME}.zip" \
    --environment "Variables={S3_BUCKET=$BUCKET,DYNAMO_TABLE=$TABLE,BEDROCK_MODEL_ID=$MODEL_ID}" \
    --region "$AWS_REGION"
}

create_lambda upload         15  512
create_lambda analyze        120 1024
create_lambda form-suggest   30  512
create_lambda generate-draft 30  1024
create_lambda session        10  256
create_lambda legal-aid      10  256
```

To re-deploy after a code change:

```bash
npm run build
for n in upload analyze form-suggest generate-draft session legal-aid; do
  aws lambda update-function-code \
    --function-name "refugeaid-$n" \
    --zip-file "fileb://dist/${n}.zip" \
    --region "$AWS_REGION"
done
```

---

## 6. Create the HTTP API (API Gateway v2)

HTTP APIs are cheaper and simpler than REST APIs and support Lambda payload v2 (which our handlers expect).

```bash
# Create the API
API_ID=$(aws apigatewayv2 create-api \
  --name refugeaid-api \
  --protocol-type HTTP \
  --cors-configuration AllowOrigins='*',AllowMethods='GET,POST,OPTIONS',AllowHeaders='Content-Type,Authorization' \
  --query ApiId --output text)
echo "API_ID=$API_ID"

# Helper — create a Lambda integration + route
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

add_route () {
  local METHOD=$1
  local PATH=$2
  local LAMBDA=$3
  local FN_ARN="arn:aws:lambda:${AWS_REGION}:${ACCOUNT}:function:refugeaid-${LAMBDA}"

  INT_ID=$(aws apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$FN_ARN" \
    --payload-format-version 2.0 \
    --query IntegrationId --output text)

  aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key "$METHOD $PATH" \
    --target "integrations/$INT_ID" >/dev/null

  # Give API Gateway permission to invoke this Lambda
  aws lambda add-permission \
    --function-name "refugeaid-${LAMBDA}" \
    --statement-id "apigw-${METHOD}-$(echo $PATH | tr '/{}' '___')" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT}:${API_ID}/*/*" >/dev/null
}

add_route POST "/upload"               upload
add_route POST "/analyze"              analyze
add_route POST "/form-suggest"         form-suggest
add_route POST "/generate-draft"       generate-draft
add_route POST "/session/save"         session
add_route GET  "/session/{sessionId}"  session
add_route GET  "/legal-aid"            legal-aid

# Deploy to a stage
aws apigatewayv2 create-stage \
  --api-id "$API_ID" \
  --stage-name prod \
  --auto-deploy

API_URL="https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com/prod"
echo "API base URL: $API_URL"
```

Set the frontend env:

```bash
echo "VITE_API_BASE_URL=$API_URL" > ../frontend/.env
```

---

## 7. Smoke test

```bash
# Legal aid (no auth, no body — fastest sanity check)
curl "$API_URL/legal-aid?country=US&language=ar"

# Upload a PDF
curl -X POST "$API_URL/upload" \
  -F "file=@/path/to/i589-sample.pdf" \
  -F "language=ar"
# → { "sessionId": "...", "status": "uploaded", ... }

# Analyze (slow — 10–30s)
curl -X POST "$API_URL/analyze" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<uuid-from-upload>","language":"ar"}'
```

CloudWatch Logs → `/aws/lambda/refugeaid-<name>` for debugging.

---

## 8. Common issues

| Symptom | Fix |
|---|---|
| `AccessDeniedException` on Bedrock | Request model access in the Bedrock console — it's not automatic. |
| `ValidationException: The provided model identifier is invalid` | Wrong `BEDROCK_MODEL_ID`. Check `aws bedrock list-foundation-models --region us-east-1`. |
| `analyze` times out | Increase Lambda timeout to 180s and memory to 2048. Textract async polling can be slow on first run. |
| `ResourceNotFoundException` on DynamoDB | Confirm `DYNAMO_TABLE` env var matches the table name exactly. |
| CORS errors in browser | API Gateway CORS is set above. If you added routes manually, re-apply the `cors-configuration` flag. |
| `413` on upload | The 5MB cap is enforced in the Lambda; API Gateway also caps payloads at 6MB. Use a presigned-PUT flow if you need bigger files. |

---

## 9. Tearing it down

```bash
# Delete in reverse order
aws apigatewayv2 delete-api --api-id "$API_ID"
for n in upload analyze form-suggest generate-draft session legal-aid; do
  aws lambda delete-function --function-name "refugeaid-$n"
done
aws iam delete-role-policy --role-name "$ROLE_NAME" --policy-name refugeaid-inline
aws iam detach-role-policy --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name "$ROLE_NAME"
aws dynamodb delete-table --table-name "$TABLE"
aws s3 rb "s3://$BUCKET" --force
```
