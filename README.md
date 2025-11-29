# aws-wallpaper-project
Wallpaper website hosted on AWS

### AWS Serverless Stack

- Cognito identity pool
- s3 static website frontend
  - shadcn UI
  - authenticate via Google oauth
  - users may not view or download images unless they have successfully authenticated with Google
- s3 private buckets for storage
  - First, when user uploads wallpaper, it should be stored in unverified bucket
    - SNS topic/subscription to email me that a wallpaper needs to be verified. Bonus points if the email can provide a direct link, or image embedded in email (I don't think or know if this is possible with SNS alone)
    - If a wallpaper with the same name exists, enumerate the filename with a number to preserve uniqueness
    - Bonus points for detecting image duplicates via SHA hash checks or something similar
- API Gateway for REST API upload
  - Consider rate limiting by IP address/email address (limit downloads to prevent download spam, uploads too, maybe. But they matter less from a financial perspective)
- Lambda function to handle image upload

