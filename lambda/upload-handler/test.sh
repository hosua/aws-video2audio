#!/bin/bash

# export proper AWS_PROFILE before using!

# environment variables should already be set via the console UI

# ensure to provide a proper object name that exists in the video2audio-input-videos bucket
INPUT_OBJECT_KEY="user-uploads/1764648655831-never-gonna-give-you-up.mkv"
OPERATION=trigger-conversion
OUTPUT_FILE=result.json

BODY_JSON=$(jq -n --arg key "$INPUT_OBJECT_KEY" --arg op "$OPERATION" '{key: $key, operation: $op}')
PAYLOAD=$(jq -n --arg body "$BODY_JSON" '{body: $body}')

aws lambda invoke \
  --function-name upload-handler \
  --payload "$PAYLOAD" \
  --cli-binary-format raw-in-base64-out \
  $OUTPUT_FILE
