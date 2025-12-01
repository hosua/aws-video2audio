import boto3
import os
import glob
from moviepy import VideoFileClip

s3 = boto3.client('s3')
sns = boto3.client('sns')
input_bucket = os.environ["INPUT_BUCKET"]
output_bucket = os.environ["OUTPUT_BUCKET"]
region = os.environ["OUTPUT_BUCKET_REGION"]

link_expires = 24 * 60 * 60

def lambda_handler(event, context):
    os.system("rm -rf /tmp/*")
    key = event["input_file"]  
    input_path = "/tmp/input.mp4"
    output_path = "/tmp/output.mp3"
    print(f"converting video file {key} to audio...")
    # dl input video
    s3.download_file(input_bucket, key, input_path)
    # convert video => audio
    video = VideoFileClip(input_path)
    audio = video.audio
    audio.write_audiofile(output_path)
    audio.close()
    video.close()
    out_key = key.rsplit(".", 1)[0] + ".mp3"

    if '/' in out_key:
        out_key = out_key.split('/')[-1]
    
    print(f"uploading file {out_key} to s3...")
    s3.upload_file(output_path, output_bucket, out_key)
    print("done!")

    email_msg = f"The audio file: \"{out_key}\" has finished processing!"
    sns_res = sns.publish(
        TopicArn=os.environ["SNS_TOPIC_ARN"],
        Message=email_msg,
        Subject='S3 Event Notification'
    )

    dl_link = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': output_bucket, 'Key': out_key},
        ExpiresIn=link_expires
    )

    return {
        "statusCode": 200,
        "message": f"Saved {out_key} to {output_bucket}",
        "download_url": dl_link
    }
