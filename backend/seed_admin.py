#!/usr/bin/env python3
"""
Seed admin user for Scribe House.

This script creates an admin user account with the provided credentials.
Supports both local and deployed (Cloud SQL) databases.

Usage:
    # Local development database
    python seed_admin.py

    # Remote/Cloud SQL database
    python seed_admin.py --remote --db-host <cloud-sql-host> --db-pass <password>

    # Using DATABASE_URL environment variable
    export DATABASE_URL="postgresql://user:pass@cloud-sql-host:5432/db"
    python seed_admin.py

Environment Variables:
    DATABASE_URL: PostgreSQL connection string (takes precedence)
"""

import asyncio
import argparse
import os
import sys
from datetime import datetime, timezone

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.core.security import get_password_hash
from app.models.user import User


async def seed_admin(database_url: str):
    """Create admin user with hardcoded credentials."""
    
    # Admin credentials
    ADMIN_EMAIL = "admin@scribehouse.raghavagarwal.com"
    ADMIN_PASSWORD = "rytse1-varhIx-cuxboq"
    ADMIN_NAME = "Scribe House Admin"
    
    # Convert to async URL if needed
    if "postgresql://" in database_url and "asyncpg" not in database_url:
        async_database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    else:
        async_database_url = database_url
    
    print(f"📝 Seeding admin user to database...")
    print(f"   Email: {ADMIN_EMAIL}")
    print(f"   Database: {database_url.split('@')[1] if '@' in database_url else 'local'}")
    
    try:
        # Create async engine with connection pooling for Cloud SQL
        engine = create_async_engine(
            async_database_url,
            echo=False,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
        )
        
        # Create async session
        async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        
        async with async_session() as session:
            # Check if admin already exists
            result = await session.execute(
                select(User).where(User.email == ADMIN_EMAIL)
            )
            existing_admin = result.scalar_one_or_none()
            
            if existing_admin:
                print(f"✅ Admin user already exists!")
                print(f"   Email: {ADMIN_EMAIL}")
                print(f"   Active: {existing_admin.is_active}")
                print(f"   Superuser: {existing_admin.is_superuser}")
                print(f"   Updated: {existing_admin.updated_at}")
                return True
            
            # Create admin user
            hashed_password = get_password_hash(ADMIN_PASSWORD)
            
            admin_user = User(
                email=ADMIN_EMAIL,
                hashed_password=hashed_password,
                full_name=ADMIN_NAME,
                is_active=True,
                is_verified=True,
                is_superuser=True,  # Grant superuser privileges
                ai_assist_enabled=True,
                created_at=datetime.now(timezone.utc),
            )
            
            session.add(admin_user)
            await session.flush()
            await session.commit()
            
            print(f"✅ Admin user created successfully!")
            print(f"   Email: {ADMIN_EMAIL}")
            print(f"   Status: Active, Verified, Superuser")
            print(f"   Created: {admin_user.created_at}")
            return True
            
    except Exception as e:
        print(f"❌ Error seeding admin user: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await engine.dispose()


def get_database_url(args) -> str:
    """Determine database URL from arguments or environment."""
    
    # Check if DATABASE_URL env var is set
    if "DATABASE_URL" in os.environ:
        return os.environ["DATABASE_URL"]
    
    # Check if remote flags are set
    if args.remote:
        if not args.db_host or not args.db_pass:
            print("❌ Error: --remote requires --db-host and --db-pass arguments")
            sys.exit(1)
        
        db_user = args.db_user or "aibook_user"
        db_name = args.db_name or "aibook"
        db_port = args.db_port or "5432"
        
        return f"postgresql://{db_user}:{args.db_pass}@{args.db_host}:{db_port}/{db_name}"
    
    # Default to local development database
    return "postgresql://aibook_user:password@localhost:5432/aibook"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Seed admin user for Scribe House application"
    )
    parser.add_argument(
        "--remote",
        action="store_true",
        help="Connect to remote Cloud SQL database"
    )
    parser.add_argument(
        "--db-host",
        help="Cloud SQL host/IP address"
    )
    parser.add_argument(
        "--db-pass",
        help="Database password"
    )
    parser.add_argument(
        "--db-user",
        default="aibook_user",
        help="Database user (default: aibook_user)"
    )
    parser.add_argument(
        "--db-name",
        default="aibook",
        help="Database name (default: aibook)"
    )
    parser.add_argument(
        "--db-port",
        default="5432",
        help="Database port (default: 5432)"
    )
    
    args = parser.parse_args()
    
    print("🌱 Scribe House Admin Seeding Script")
    print("=" * 60)
    
    database_url = get_database_url(args)
    success = asyncio.run(seed_admin(database_url))
    
    print("=" * 60)
    if success:
        print("✨ Seeding complete!")
        sys.exit(0)
    else:
        print("❌ Seeding failed!")
        sys.exit(1)
