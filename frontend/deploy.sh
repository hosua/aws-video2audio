#!/bin/bash

set -e

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source .env file from project root
if [ -f "$PROJECT_ROOT/.env" ]; then
  source "$PROJECT_ROOT/.env"
else
  echo "Error: .env file not found at $PROJECT_ROOT/.env"
  exit 1
fi

# Check if FRONTEND_BUCKET_NAME is set
if [ -z "$FRONTEND_BUCKET_NAME" ]; then
  echo "Error: FRONTEND_BUCKET_NAME is not set in .env file"
  exit 1
fi

echo "Building frontend..."
cd "$SCRIPT_DIR"
npm run build

if [ ! -d "dist" ]; then
  echo "Error: Build failed - dist directory not found"
  exit 1
fi

echo "Deploying to S3 bucket: $FRONTEND_BUCKET_NAME"
aws s3 sync dist/ s3://$FRONTEND_BUCKET_NAME/ --delete

echo "Setting up static website hosting..."
aws s3 website s3://$FRONTEND_BUCKET_NAME/ \
  --index-document index.html \
  --error-document index.html

echo "Setting bucket policy for public read access..."
aws s3api put-bucket-policy --bucket $FRONTEND_BUCKET_NAME --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Sid\": \"PublicReadGetObject\",
      \"Effect\": \"Allow\",
      \"Principal\": \"*\",
      \"Action\": \"s3:GetObject\",
      \"Resource\": \"arn:aws:s3:::$FRONTEND_BUCKET_NAME/*\"
    }
  ]
}"

echo "Removing public access block..."
aws s3api put-public-access-block \
  --bucket $FRONTEND_BUCKET_NAME \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

echo "Deployment complete!"
echo "Website URL: http://$FRONTEND_BUCKET_NAME.s3-website-$(aws configure get region || echo 'us-east-1').amazonaws.com"
