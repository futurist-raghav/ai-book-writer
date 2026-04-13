"""
Minimal FastAPI Health Check Server

Simple fallback when main app has import errors.
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
import os
from datetime import datetime

app = FastAPI(title="Scribe House API (Health Check Mode)")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "scribe-house-backend",
        "timestamp": datetime.utcnow().isoformat(),
        "mode": "health-check",
        "backend_url": "http://34.14.172.251:8000"
    }

@app.get("/health/db")
async def db_health():
    """Database health check."""
    try:
        import psycopg2
        from psycopg2 import sql
        
        conn = psycopg2.connect(
            dbname=os.getenv("DB_NAME", "ai_book_writer"),
            user=os.getenv("DB_USER", "aiwriter"),
            password=os.getenv("DB_PASSWORD", "aiwriter_secure_pass_2024"),
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432"))
        )
        cursor = conn.cursor()
        cursor.execute("SELECT version()")
        version = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        
        return {
            "status": "healthy",
            "database": "postgresql",
            "version": version
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "error": str(e)}
        )

@app.get("/api/v1/health")
async def api_health():
    """API v1 health check."""
    return {
        "status": "healthy",
        "api_version": "v1",
        "backend_ready": True
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
