"""
AI Book Writer - FastAPI Application

Main entry point for the backend API.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import close_db, init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Handles startup and shutdown events.
    """
    # Startup
    if settings.ENVIRONMENT == "development":
        # Only auto-create tables in development
        # Use Alembic migrations in production
        await init_db()

    yield

    # Shutdown
    await close_db()


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="Transform voice recordings into professionally formatted books using AI",
    version=settings.VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Check if the API is running."""
    return {"status": "healthy", "version": settings.VERSION}


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """API root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.VERSION,
        "docs": "/docs" if settings.DEBUG else "Disabled in production",
    }


# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handle uncaught exceptions."""
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal error occurred",
            "error": str(exc) if settings.DEBUG else "Internal server error",
        },
    )
