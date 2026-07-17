import json
import boto3
import uuid
from datetime import datetime
from decimal import Decimal

s3 = boto3.client("s3")
polly = boto3.client("polly")
dynamodb = boto3.resource("dynamodb")

# ==========================
# YOUR SERVICES
# ==========================
BUCKET_NAME = "story-mp3-s"
TABLE_NAME = "story-mp3"
VOICE_ID = "Joanna"

table = dynamodb.Table(TABLE_NAME)


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def response(code, body):
    return {
        "statusCode": code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "*"
        },
        "body": json.dumps(body, cls=DecimalEncoder)
    }


def lambda_handler(event, context):

    print(json.dumps(event))

    method = event["requestContext"]["http"]["method"]
    path = event["rawPath"]

    try:

        # =========================================
        # POST /upload
        # =========================================

        if method == "POST" and path == "/upload":

            body = json.loads(event["body"])

            # JavaScript sends fileName
            filename = body["fileName"]
            story = body["story"]

            mp3id = str(uuid.uuid4())

            txt_key = f"stories/{filename}"
            mp3_key = f"audio/{filename.replace('.txt','.mp3')}"

            # Upload TXT
            s3.put_object(
                Bucket=BUCKET_NAME,
                Key=txt_key,
                Body=story,
                ContentType="text/plain"
            )

            # Convert to MP3
            polly_response = polly.synthesize_speech(
                Text=story,
                OutputFormat="mp3",
                VoiceId=VOICE_ID
            )

            audio = polly_response["AudioStream"].read()

            # Upload MP3
            s3.put_object(
                Bucket=BUCKET_NAME,
                Key=mp3_key,
                Body=audio,
                ContentType="audio/mpeg"
            )

            audio_url = f"https://{BUCKET_NAME}.s3.amazonaws.com/{mp3_key}"

            # Save Metadata
            table.put_item(
                Item={
                    "mp3id": mp3id,
                    "storyName": filename,
                    "textFile": txt_key,
                    "audioFile": mp3_key,
                    "audioUrl": audio_url,
                    "voice": VOICE_ID,
                    "createdAt": datetime.utcnow().isoformat()
                }
            )

            return response(200, {
                "message": "Story uploaded successfully",
                "audioUrl": audio_url
            })

        # =========================================
        # GET /stories
        # =========================================

        elif method == "GET" and path == "/stories":

            data = table.scan()

            return response(200, data["Items"])

        # =========================================
        # Invalid Route
        # =========================================

        return response(404, {
            "message": "Invalid Route"
        })

    except Exception as e:

        print(str(e))

        return response(500, {
            "error": str(e)
        })