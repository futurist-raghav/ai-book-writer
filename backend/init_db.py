#!/usr/bin/env python3
"""
Bootstrap database tables without migrations.

This script creates all database tables using SQLAlchemy's metadata.create_all()
directly from the models. Useful when migrations have issues or for fresh setup.

Usage:
    python init_db.py              # Initialize tables only
    python init_db.py --with-seed  # Initialize tables and create admin user
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import Base, engine
from app.core.security import get_password_hash
from app.models.user import User

# Import all models to register them with Base
from app.models import (
    user, book, chapter, event, audio, transcription,
    collaboration, comment, custom_fields, device_preview,
    entity, export_bundle, flow_engine, glossary,
    import_source, marketplace_template, mobile,
    monetization, publishing_pipeline, review_link,
    section_approval, workspace, workspace_customization,
    drafts, drm_models, author_community, public_share,
    writing_performance, agent_usage, accessibility,
    bibliography, chapter_edit, classroom, comment,
    formatting_theme, matter_config, suggestion
)


async def init_db():
    """Create all tables in the database."""
    async with engine.begin() as conn:
        # Create all tables defined in Base.metadata
        await conn.run_sync(Base.metadata.create_all)
        
        print("✅ Database tables created successfully!")
        
        # Verify some tables were created
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            LIMIT 5
        """))
        
        tables = result.fetchall()
        print(f"\n📋 Sample tables created:")
        for table in tables:
            print(f"  - {table[0]}")
        
        if len(tables) < 5:
            print(f"\n⚠️  Only {len(tables)} tables found. Check for warnings above.")


async def seed_admin_user():
    """Create admin user account."""
    from sqlalchemy.orm import sessionmaker
    
    ADMIN_EMAIL = "admin@scribehouse.raghavagarwal.com"
    ADMIN_PASSWORD = "rytse1-varhIx-cuxboq"
    ADMIN_NAME = "Scribe House Admin"
    
    print("\n🌱 Seeding admin user...")
    print(f"   Email: {ADMIN_EMAIL}")
    
    try:
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session() as session:
            # Check if admin already exists
            result = await session.execute(
                select(User).where(User.email == ADMIN_EMAIL)
            )
            existing_admin = result.scalar_one_or_none()
            
            if existing_admin:
                print(f"✅ Admin user already exists")
                return
            
            # Create admin user
            hashed_password = get_password_hash(ADMIN_PASSWORD)
            
            admin_user = User(
                email=ADMIN_EMAIL,
                hashed_password=hashed_password,
                full_name=ADMIN_NAME,
                is_active=True,
                is_verified=True,
                is_superuser=True,
                ai_assist_enabled=True,
                created_at=datetime.now(timezone.utc),
            )
            
            session.add(admin_user)
            await session.commit()
            
            print(f"✅ Admin user created successfully!")
            print(f"   Status: Active, Verified, Superuser")
            
    except Exception as e:
        print(f"❌ Error seeding admin user: {e}")
        raise

        
if __name__ == "__main__":
    try:
        print("🚀 Scribe House - Database Initialization")
        print("=" * 50)
        asyncio.run(init_db())
        
        # Check if --with-seed flag was provided
        if "--with-seed" in sys.argv:
            asyncio.run(seed_admin_user())
        
        print("=" * 50)
        print("✨ Database initialization complete!")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
