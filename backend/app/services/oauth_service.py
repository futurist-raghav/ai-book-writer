"""
OAuth service for managing external API authentication.

Handles token refresh, validation, and credential management
for various OAuth providers.
"""

import logging
import json
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

import httpx

logger = logging.getLogger(__name__)


class OAuthService:
    """Service for OAuth token management across providers"""

    # Provider-specific endpoints
    PROVIDER_CONFIG = {
        "goodreads": {
            "token_url": "https://www.goodreads.com/oauth/token",
            "validate_url": "https://www.goodreads.com/api/auth_user",
        },
        "openai": {
            "token_url": "https://api.openai.com/v1/oauth/token",
            "validate_url": "https://api.openai.com/v1/models",
        },
        "draft2digital": {
            "token_url": "https://api.draft2digital.com/oauth/token",
            "validate_url": "https://api.draft2digital.com/v1/account",
        },
        "smashwords": {
            "token_url": "https://www.smashwords.com/oauth/token",
            "validate_url": "https://api.smashwords.com/v1/author",
        },
    }

    def __init__(self, timeout: int = 10):
        self.timeout = timeout
        self.http_client = httpx.AsyncClient(timeout=timeout)

    async def refresh_token(
        self,
        provider: str,
        refresh_token: str,
        client_id: str,
        client_secret: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Refresh OAuth token for a provider.
        
        Args:
            provider: OAuth provider name
            refresh_token: Current refresh token
            client_id: OAuth client ID
            client_secret: OAuth client secret
        
        Returns:
            New token data with access_token, expires_in, etc.
            Or None if refresh fails
        """
        config = self.PROVIDER_CONFIG.get(provider)
        if not config:
            logger.error(f"Unknown OAuth provider: {provider}")
            return None

        try:
            payload = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": client_id,
                "client_secret": client_secret,
            }

            response = await self.http_client.post(
                config["token_url"],
                data=payload,
            )

            if response.status_code == 200:
                data = response.json()
                logger.info(f"Successfully refreshed token for {provider}")
                return data
            else:
                logger.error(
                    f"Token refresh failed for {provider}: {response.status_code}"
                )
                return None

        except Exception as e:
            logger.error(f"Error refreshing token for {provider}: {str(e)}")
            return None

    async def validate_token(
        self,
        provider: str,
        access_token: str,
    ) -> bool:
        """
        Validate that an access token is still valid with the provider.
        
        Args:
            provider: OAuth provider name
            access_token: Access token to validate
        
        Returns:
            True if token is valid, False otherwise
        """
        config = self.PROVIDER_CONFIG.get(provider)
        if not config:
            logger.error(f"Unknown OAuth provider: {provider}")
            return False

        try:
            headers = {
                "Authorization": f"Bearer {access_token}",
            }

            response = await self.http_client.get(
                config["validate_url"],
                headers=headers,
            )

            is_valid = response.status_code == 200
            
            if is_valid:
                logger.debug(f"Token valid for {provider}")
            else:
                logger.warning(f"Token invalid for {provider}: {response.status_code}")
            
            return is_valid

        except Exception as e:
            logger.error(f"Error validating token for {provider}: {str(e)}")
            return False

    def get_token_expiry(
        self,
        provider: str,
        expires_in: int,
    ) -> datetime:
        """
        Calculate token expiry datetime from expires_in seconds.
        
        Args:
            provider: OAuth provider name
            expires_in: Seconds until token expires
        
        Returns:
            Datetime when token will expire
        """
        # Subtract 5 minutes to refresh before actual expiry
        return datetime.utcnow() + timedelta(seconds=expires_in - 300)

    def build_auth_url(
        self,
        provider: str,
        client_id: str,
        redirect_uri: str,
        scope: str = "",
        state: str = "",
    ) -> Optional[str]:
        """
        Build OAuth authorization URL for user login flow.
        
        Args:
            provider: OAuth provider name
            client_id: OAuth client ID
            redirect_uri: Callback URL after authorization
            scope: Requested scopes
            state: CSRF token for security
        
        Returns:
            Authorization URL for user to visit
        """
        auth_urls = {
            "goodreads": f"https://www.goodreads.com/oauth/authorize?"
                        f"client_id={client_id}&response_type=code&"
                        f"redirect_uri={redirect_uri}",
            "openai": f"https://openai.com/oauth/authorize?"
                     f"client_id={client_id}&response_type=code&"
                     f"redirect_uri={redirect_uri}&scope={scope}&state={state}",
            "draft2digital": f"https://api.draft2digital.com/oauth/authorize?"
                           f"client_id={client_id}&response_type=code&"
                           f"redirect_uri={redirect_uri}",
            "smashwords": f"https://www.smashwords.com/oauth/authorize?"
                         f"client_id={client_id}&response_type=code&"
                         f"redirect_uri={redirect_uri}",
        }
        
        return auth_urls.get(provider)

    async def exchange_code_for_token(
        self,
        provider: str,
        code: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Exchange authorization code for access token.
        
        Called after user returns from OAuth provider login.
        
        Args:
            provider: OAuth provider name
            code: Authorization code from provider
            client_id: OAuth client ID
            client_secret: OAuth client secret
            redirect_uri: Redirect URI (must match registered URI)
        
        Returns:
            Token data with access_token, refresh_token, expires_in
        """
        config = self.PROVIDER_CONFIG.get(provider)
        if not config:
            logger.error(f"Unknown OAuth provider: {provider}")
            return None

        try:
            payload = {
                "grant_type": "authorization_code",
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
            }

            response = await self.http_client.post(
                config["token_url"],
                data=payload,
            )

            if response.status_code == 200:
                data = response.json()
                logger.info(f"Successfully exchanged code for {provider}")
                return data
            else:
                logger.error(
                    f"Code exchange failed for {provider}: {response.status_code}"
                )
                return None

        except Exception as e:
            logger.error(f"Error exchanging code for {provider}: {str(e)}")
            return None

    async def revoke_token(
        self,
        provider: str,
        token: str,
        client_id: str,
        client_secret: str,
    ) -> bool:
        """
        Revoke an access token with the provider.
        
        Called when disconnecting an integration.
        
        Args:
            provider: OAuth provider name
            token: Token to revoke
            client_id: OAuth client ID
            client_secret: OAuth client secret
        
        Returns:
            True if revocation successful, False otherwise
        """
        revoke_urls = {
            "goodreads": "https://www.goodreads.com/oauth/revoke",
            "openai": "https://api.openai.com/v1/oauth/revoke",
            "draft2digital": "https://api.draft2digital.com/oauth/revoke",
            "smashwords": "https://www.smashwords.com/oauth/revoke",
        }

        revoke_url = revoke_urls.get(provider)
        if not revoke_url:
            logger.error(f"No revoke URL for {provider}")
            return False

        try:
            payload = {
                "token": token,
                "client_id": client_id,
                "client_secret": client_secret,
            }

            response = await self.http_client.post(
                revoke_url,
                data=payload,
            )

            is_revoked = response.status_code == 200
            
            if is_revoked:
                logger.info(f"Token revoked for {provider}")
            else:
                logger.warning(f"Token revocation failed for {provider}: {response.status_code}")
            
            return is_revoked

        except Exception as e:
            logger.error(f"Error revoking token for {provider}: {str(e)}")
            return False
