# lambda/upload-handler/lambda_function.py
import boto3
import json
import os
from botocore.exceptions import ClientError

s3 = boto3.client('s3')
lambda_client = boto3.client('lambda')
input_bucket = os.environ["INPUT_BUCKET"]
output_bucket = os.environ.get("OUTPUT_BUCKET")
convert_lambda_name = os.environ.get("CONVERT_LAMBDA_NAME")
key_prefix = "user-uploads"

cors_header = {
    'Access-Control-Allow-Origin': '*'
}
json_cors_header = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
}

def lambda_handler(event, context):
    try:
        body = json.loads(event.get('body', '{}'))
        key = body.get('key')
        content_type = body.get('contentType', 'video/mp4')
        operation = body.get('operation')

        if not key:
            return {
                'statusCode': 400,
                'headers': json_cors_header,
                'body': json.dumps({'message': 'Missing key parameter'})
            }

        if operation == 'trigger-conversion':
            # Trigger the conversion Lambda
            if not convert_lambda_name:
                return {
                    'statusCode': 500,
                    'headers': json_cors_header,
                    'body': json.dumps({'message': 'CONVERT_LAMBDA_NAME not configured'})
                }

            full_key = f"{key_prefix}/{key}" if not key.startswith(key_prefix) else key

            # Invoke the conversion Lambda
            response = lambda_client.invoke(
                FunctionName=convert_lambda_name,
                InvocationType='Event',  # Async invocation
                Payload=json.dumps({
                    'input_file': full_key
                })
            )

            return {
                'statusCode': 200,
                'headers': json_cors_header,
                'body': json.dumps({
                    'message': 'Conversion started',
                    'statusCode': response['StatusCode']
                })
            }
        elif operation == 'get-audio':
            if not output_bucket:
                return {
                    'statusCode': 500,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'message': 'OUTPUT_BUCKET not configured'})
                }

            # Convert key to MP3 filename
            # Remove prefix if present
            if key.startswith(key_prefix + '/'):
                key = key.replace(key_prefix + '/', '')

            # Remove extension and add .mp3
            mp3_key = key.rsplit('.', 1)[0] + '.mp3'

            print(f"Checking for MP3 key: {mp3_key} in bucket: {output_bucket}")

            # Check if file exists
            try:
                s3.head_object(Bucket=output_bucket, Key=mp3_key)
                print(f"File found! Generating presigned URL...")
                # File exists - generate presigned URL
                presigned_url = s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': output_bucket, 'Key': mp3_key},
                    ExpiresIn=3600
                )
                return {
                    'statusCode': 200,
                    'headers': cors_header,
                    'body': json.dumps({'status': 'ready', 'presignedUrl': presigned_url})
                }
            except ClientError as e:
                error_code = e.response['Error']['Code']
                print(f"File not found. Error code: {error_code}")
                if error_code == '404':
                    return {
                        'statusCode': 202,
                        'headers': cors_header,
                        'body': json.dumps({'status': 'processing'})
                    }
                raise

        # Default: Generate PUT presigned URL for upload
        key = f"{key_prefix}/{key}"

        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': input_bucket,
                'Key': key,
                'ContentType': content_type
            },
            ExpiresIn=3600
        )

        return {
            'statusCode': 200,
            'headers': json_cors_header,
            'body': json.dumps({'presignedUrl': presigned_url})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': json_cors_header,
            'body': json.dumps({'message': str(e)})
        }
