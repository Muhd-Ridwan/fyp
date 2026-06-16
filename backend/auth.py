"""
Cognito JWT verification.

Fetches User Pool's public singing keys (JWKS) once, cahces them, and
checks each incoming token's signature locally - no AWS API call needed per request

The frontend must send the ID token (not the access token), because the ID token
contains the 'email' claim used for the DynamoDB lookup.
"""
# Push this just to try CICD working or not
# 2nd push to try CI/CD
# 3rd push to try CI/CD

import time
import requests
from jose import jwt, jwk
from jose.utils import base64url_decode

import config

class TokenVerificationError(Exception):
    """Raised when a Cognito ID token fails verification for any reason."""

class CognitoJWTVerifier:
    def __init__(self, region:str, user_pool_id: str, app_client_id: str):
        self.region = region
        self.user_pool_id = user_pool_id
        self.app_client_id = app_client_id
        self.issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
        self.jwks_url = f"{self.issuer}/.well-known/jwks.json"
        self._jwks_keys = None
        self._jwks_fetched_at = 0.0
        self._jwks_ttl_seconds = 3600
    
    def _get_jwks_keys(self):
        now = time.time()
        if self._jwks_keys is None or (now - self._jwks_fetched_at) > self._jwks_ttl_seconds:
            response = requests.get(self.jwks_url, timeout=5)
            response.raise_for_status()
            self._jwks_keys = response.json()["keys"]
            self._jwks_fetched_at = now
        return self._jwks_keys
    
    def verify_token(self, token:str) -> dict:
        try:
            headers = jwt.get_unverified_header(token)
        except Exception as exc:
            raise TokenVerificationError(f"Malformed token header: {exc}") from exc
        
        kid = headers.get("kid")
        if kid is None:
            raise TokenVerificationError("Token header missing 'kid'")
        
        matching_key = next(
            (key for key in self._get_jwks_keys() if key["kid"] == kid), None
        )
        if matching_key is None:
            self._jwks_keys = None
            matching_key = next(
                (key for key in self._get_jwks_keys() if key["kid"] == kid), None
            )
            if matching_key is None:

                raise TokenVerificationError("No matching JWKS key found for token")
        
        public_key = jwk.construct(matching_key)

        message, encoded_signature = token.rsplit(".", 1)
        decoded_signature = base64url_decode(encoded_signature.encode("utf-8"))

        if not public_key.verify(message.encode("utf-8"), decoded_signature):
            raise TokenVerificationError("Token signature is invalid")
        
        claims = jwt.get_unverified_claims(token)

        if time.time() > claims.get("exp", 0):
            raise TokenVerificationError("Token has expired")
        if claims.get("iss") != self.issuer:
            raise TokenVerificationError("Token issuer does not match this User Pool")
        
        token_client_id = claims.get("aud") or claims.get("client_id")
        if token_client_id != self.app_client_id:
            raise TokenVerificationError("Token was not issued for this app client")
        
        if claims.get("token_use") not in ("id", "access"):
            raise TokenVerificationError("Unexpected token_use claim")
        
        return claims

verifier = CognitoJWTVerifier(
    region=config.AWS_REGION,
    user_pool_id=config.COGNITO_USER_POOL_ID,
    app_client_id=config.COGNITO_APP_CLIENT_ID,
)