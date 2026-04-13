"""
Backend Auto-Initialization Service

Automatically initializes Ollama and Gemma 4 model on backend startup.
Ensures STT is ready without any manual intervention.
"""

import asyncio
import logging
import os
import subprocess
import time
from typing import Dict, Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class OllamaInitializer:
    """
    Handles automatic Ollama setup and Gemma 4 model deployment.
    
    Features:
    - Detects Ollama installation
    - Waits for Ollama service startup
    - Auto-pulls Gemma 4 model if missing
    - Verifies STT connectivity
    """

    def __init__(self):
        """Initialize Ollama initializer."""
        self.base_url = settings.GEMMA4_BASE_URL or "http://localhost:11434"
        self.model = settings.GEMMA4_MODEL or "gemma4:latest"
        self.timeout = settings.GEMMA4_AUTO_DEPLOY_WAIT_TIMEOUT or 900  # 15 minutes
        self.health_check_interval = 2  # seconds
        self.max_retries = self.timeout // self.health_check_interval

    async def initialize(self) -> Dict[str, Any]:
        """
        Run full initialization sequence.
        
        Returns:
            Dict with initialization status and details
        """
        logger.info("Starting Ollama auto-initialization sequence...")
        
        try:
            # Step 1: Ensure Ollama is running
            logger.info(f"Waiting for Ollama service at {self.base_url}...")
            await self._wait_for_ollama()
            logger.info("✓ Ollama service is ready")
            
            # Step 2: Check if model needs to be pulled
            logger.info(f"Checking for {self.model} model...")
            model_ready = await self._check_model_available()
            
            if not model_ready:
                logger.info(f"Model {self.model} not found. Auto-pulling...")
                await self._pull_model()
                logger.info(f"✓ Model {self.model} pulled successfully")
            else:
                logger.info(f"✓ Model {self.model} is already available")
            
            # Step 3: Verify STT connectivity
            logger.info("Verifying STT service connectivity...")
            connectivity_ok = await self._verify_stt_connectivity()
            
            if connectivity_ok:
                logger.info("✓ STT service is operational")
                return {
                    "status": "success",
                    "message": "Gemma 4 STT initialized successfully",
                    "model": self.model,
                    "ollama_url": self.base_url,
                }
            else:
                logger.warning("STT service connectivity verification inconclusive, but Ollama is running")
                return {
                    "status": "warning",
                    "message": "Ollama running but couldn't verify full STT connectivity",
                    "model": self.model,
                    "ollama_url": self.base_url,
                }
                
        except Exception as e:
            logger.error(f"✗ Initialization failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
                "model": self.model,
            }

    async def _wait_for_ollama(self, timeout: Optional[int] = None) -> bool:
        """
        Wait for Ollama service to become available.
        
        Args:
            timeout: Maximum time to wait in seconds
        
        Returns:
            True if Ollama is ready, False if timeout
        
        Raises:
            Exception if waiting times out
        """
        max_wait = timeout or self.timeout
        start_time = time.time()
        
        async with httpx.AsyncClient(timeout=5) as client:
            while time.time() - start_time < max_wait:
                try:
                    response = await client.get(f"{self.base_url}/api/tags")
                    if response.status_code == 200:
                        logger.debug("Ollama is responding to requests")
                        return True
                except Exception:
                    pass  # Service not ready yet
                
                # Wait before retrying
                await asyncio.sleep(self.health_check_interval)
        
        raise TimeoutError(f"Ollama service at {self.base_url} did not come online within {max_wait} seconds")

    async def _check_model_available(self) -> bool:
        """
        Check if the required Gemma model is available locally.
        
        Returns:
            True if model is available, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                
                if response.status_code != 200:
                    logger.warning(f"Failed to fetch model list: {response.status_code}")
                    return False
                
                data = response.json()
                models = data.get("models", [])
                model_names = [m.get("name", "") for m in models]
                
                logger.debug(f"Available models: {model_names}")
                
                # Check if exact model or compatible variant is available
                for model_name in model_names:
                    if self.model in model_name or model_name.startswith("gemma4"):
                        logger.info(f"Found compatible model: {model_name}")
                        return True
                
                return False
        except Exception as e:
            logger.warning(f"Error checking model availability: {e}")
            return False

    async def _pull_model(self) -> bool:
        """
        Pull the Gemma model using Ollama CLI.
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Use subprocess to run ollama pull
            logger.info(f"Executing: ollama pull {self.model}")
            
            # Run in executor to avoid blocking async event loop
            loop = asyncio.get_event_loop()
            process = await loop.run_in_executor(
                None,
                lambda: subprocess.Popen(
                    ["ollama", "pull", self.model],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                )
            )
            
            # Wait for completion with timeout
            try:
                stdout, stderr = await asyncio.wait_for(
                    loop.run_in_executor(None, process.communicate),
                    timeout=self.timeout
                )
                
                if process.returncode == 0:
                    logger.info(f"Successfully pulled model: {self.model}")
                    logger.debug(f"Pull output: {stdout}")
                    return True
                else:
                    logger.error(f"Failed to pull model: {stderr}")
                    return False
            except asyncio.TimeoutError:
                process.kill()
                logger.error(f"Model pull timed out after {self.timeout} seconds")
                raise
                
        except FileNotFoundError:
            logger.error("ollama command not found. Is Ollama installed?")
            raise
        except Exception as e:
            logger.error(f"Error pulling model: {e}")
            raise

    async def _verify_stt_connectivity(self) -> bool:
        """
        Test STT service by making a simple request.
        
        Returns:
            True if service responds, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Test with a simple prompt
                payload = {
                    "model": self.model,
                    "prompt": "Test transcription request.",
                    "stream": False,
                }
                
                logger.debug(f"Testing STT with payload: {payload}")
                
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload,
                )
                
                if response.status_code == 200:
                    logger.info("STT service test successful")
                    return True
                else:
                    logger.warning(f"STT service returned status {response.status_code}")
                    logger.debug(f"Response: {response.text}")
                    return False
                    
        except asyncio.TimeoutError:
            logger.warning("STT service test timed out")
            return False
        except Exception as e:
            logger.warning(f"Error testing STT service: {e}")
            # Don't fail on test connectivity issues - Ollama might be busy
            return False

    @staticmethod
    async def install_ollama() -> bool:
        """
        Attempt to install Ollama if not already installed.
        
        Supports macOS, Linux, and Windows.
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if Ollama is already installed
            result = subprocess.run(
                ["which", "ollama"],
                capture_output=True,
                timeout=5,
            )
            
            if result.returncode == 0:
                logger.info("Ollama is already installed")
                return True
            
            logger.info("Ollama not found, attempting installation...")
            
            # Detect OS and install
            import platform
            os_type = platform.system()
            
            if os_type == "Darwin":  # macOS
                logger.info("Installing Ollama for macOS via Homebrew...")
                subprocess.run(["brew", "install", "ollama"], check=True)
            elif os_type == "Linux":
                logger.info("Installing Ollama for Linux...")
                subprocess.run(
                    ["bash", "-c", "curl -fsSL https://ollama.ai/install.sh | sh"],
                    check=True,
                )
            elif os_type == "Windows":
                logger.warning("Windows detected. Please install Ollama manually from https://ollama.ai")
                return False
            else:
                logger.warning(f"Unsupported OS: {os_type}")
                return False
            
            logger.info("Ollama installation completed")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Installation failed: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during installation: {e}")
            return False

    @staticmethod
    async def start_ollama_service() -> bool:
        """
        Start Ollama service if not already running.
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if Ollama is already running
            async with httpx.AsyncClient(timeout=2) as client:
                try:
                    response = await client.get("http://localhost:11434/api/tags")
                    if response.status_code == 200:
                        logger.info("Ollama service is already running")
                        return True
                except Exception:
                    pass
            
            # Start Ollama
            import platform
            os_type = platform.system()
            
            if os_type == "Darwin":  # macOS
                logger.info("Starting Ollama for macOS...")
                subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            elif os_type == "Linux":
                logger.info("Starting Ollama for Linux...")
                subprocess.Popen(
                    ["bash", "-c", "ollama serve"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                logger.warning(f"Cannot auto-start Ollama on {os_type}")
                return False
            
            # Wait for service to be ready
            await asyncio.sleep(2)
            logger.info("Ollama service started")
            return True
            
        except Exception as e:
            logger.error(f"Error starting Ollama service: {e}")
            return False


class BackendInitializer:
    """Main backend initialization orchestrator."""
    
    def __init__(self):
        """Initialize backend initializer."""
        self.ollama_initializer = OllamaInitializer()
    
    async def initialize_all(self) -> Dict[str, Any]:
        """
        Run all backend initialization tasks.
        
        Returns:
            Dict with overall initialization status
        """
        logger.info("=" * 60)
        logger.info("Backend Auto-Initialization Starting")
        logger.info("=" * 60)
        
        # Skip if auto-deploy is disabled
        if not settings.GEMMA4_AUTO_DEPLOY:
            logger.info("Auto-deploy is disabled (GEMMA4_AUTO_DEPLOY=False)")
            return {
                "status": "skipped",
                "message": "Auto-deploy disabled",
            }
        
        # Run Ollama initialization
        ollama_result = await self.ollama_initializer.initialize()
        
        logger.info("=" * 60)
        logger.info(f"Initialization Status: {ollama_result.get('status', 'unknown').upper()}")
        logger.info("=" * 60)
        
        return ollama_result


# Singleton initialization instance
_backend_initializer: Optional[BackendInitializer] = None


async def get_backend_initializer() -> BackendInitializer:
    """Get or create the backend initializer."""
    global _backend_initializer
    if _backend_initializer is None:
        _backend_initializer = BackendInitializer()
    return _backend_initializer


async def initialize_backend() -> Dict[str, Any]:
    """
    Async function to initialize backend on startup.
    
    Call this in app startup event.
    """
    initializer = await get_backend_initializer()
    return await initializer.initialize_all()
