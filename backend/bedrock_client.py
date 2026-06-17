"""
Bedrock client for fyp.
2 Responsibilities
    1. get_embedding() - calls titan embedding v2 to convert text to vector
    2. generate_response() - calls claude haiku 4.5 to produce a grounded answer
"""

import json
import boto3
from config import AWS_REGION, BEDROCK_EMBEDDING_MODEL_ID, BEDROCK_GENERATION_MODEL_ID

_bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)

def get_embedding(text: str) -> list[float]:
    """Convert a text string into a 1024-dimension vector using Titan Embeddings V2"""
    body = json.dumps({
        "inputText": text,
        "dimensions": 1024,
        "normalize": True
    })
    response = _bedrock.invoke_model(
        modelId=BEDROCK_EMBEDDING_MODEL_ID,
        body=body,
        contentType="application/json",
        accept="application/json"
    )
    result = json.loads(response["body"].read())
    return result["embedding"]

def generate_response(prompt: str) -> str:
    """Send a prompt to Claude Haiku 4.5 and return the text response"""
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    })
    response = _bedrock.invoke_model(
        modelId=BEDROCK_GENERATION_MODEL_ID,
        body=body,
        contentType="application/json",
        accept="application/json"
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]