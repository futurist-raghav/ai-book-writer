"""Add monetization models.

Revision ID: 018_monetization
Revises: 017
Create Date: 2024-01-01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by alembic.
revision = '018_monetization'
down_revision = '017'
branch_labels = None
depends_on = None


def upgrade():
    """Create monetization tables."""
    
    # AuthorSubscription
    op.create_table(
        'author_subscriptions',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('user_id', sa.String(36), nullable=False, unique=True),
        sa.Column('tier', sa.String(50), default='free'),
        sa.Column('features', sa.JSON()),
        sa.Column('stripe_customer_id', sa.String(100)),
        sa.Column('stripe_subscription_id', sa.String(100)),
        sa.Column('monthly_price_cents', sa.Integer),
        sa.Column('annual_price_cents', sa.Integer),
        sa.Column('billing_cycle', sa.String(50), default='monthly'),
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('is_trial', sa.Integer, default=0),
        sa.Column('trial_ends_at', sa.DateTime),
        sa.Column('next_billing_date', sa.DateTime),
        sa.Column('auto_renew', sa.Integer, default=1),
        sa.Column('books_limit', sa.Integer, default=3),
        sa.Column('collaborators_limit', sa.Integer, default=5),
        sa.Column('storage_gb', sa.Integer, default=10),
        sa.Column('beta_readers_limit', sa.Integer, default=10),
        sa.Column('books_created', sa.Integer, default=0),
        sa.Column('collaborators_added', sa.Integer, default=0),
        sa.Column('storage_used_mb', sa.Integer, default=0),
        sa.Column('activated_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('renewed_at', sa.DateTime),
        sa.Column('cancelled_at', sa.DateTime),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_author_subscriptions_user_id', 'author_subscriptions', ['user_id'])
    
    # MarketplaceRoyalty
    op.create_table(
        'marketplace_royalties',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('book_id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('total_sales', sa.Integer, default=0),
        sa.Column('total_revenue_cents', sa.Integer, default=0),
        sa.Column('royalty_percentage', sa.Float, default=0.30),
        sa.Column('total_royalty_cents', sa.Integer, default=0),
        sa.Column('payouts_pending_cents', sa.Integer, default=0),
        sa.Column('payouts_paid_cents', sa.Integer, default=0),
        sa.Column('last_payout_at', sa.DateTime),
        sa.Column('next_payout_at', sa.DateTime),
        sa.Column('platform_fee_percent', sa.Float, default=0.30),
        sa.Column('author_earnings_cents', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_marketplace_royalties_book_id', 'marketplace_royalties', ['book_id'])
    op.create_index('ix_marketplace_royalties_user_id', 'marketplace_royalties', ['user_id'])
    
    # AffiliateLink
    op.create_table(
        'affiliate_links',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('book_id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('code', sa.String(50), unique=True),
        sa.Column('short_url', sa.String(500)),
        sa.Column('clicks', sa.Integer, default=0),
        sa.Column('conversions', sa.Integer, default=0),
        sa.Column('conversion_rate', sa.Float, default=0.0),
        sa.Column('revenue_cents', sa.Integer, default=0),
        sa.Column('commission_percent', sa.Float, default=0.15),
        sa.Column('commission_earned_cents', sa.Integer, default=0),
        sa.Column('source', sa.String(100)),
        sa.Column('custom_label', sa.String(255)),
        sa.Column('is_active', sa.Integer, default=1),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_affiliate_links_code', 'affiliate_links', ['code'])
    op.create_index('ix_affiliate_links_book_id', 'affiliate_links', ['book_id'])
    op.create_index('ix_affiliate_links_user_id', 'affiliate_links', ['user_id'])
    
    # PricingRecommendation
    op.create_table(
        'pricing_recommendations',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('book_id', sa.String(36), nullable=False, unique=True),
        sa.Column('current_price_cents', sa.Integer),
        sa.Column('current_price_tier', sa.String(50)),
        sa.Column('recommended_price_cents', sa.Integer),
        sa.Column('price_confidence', sa.Float, default=0.0),
        sa.Column('genre', sa.String(100)),
        sa.Column('comparable_books_count', sa.Integer, default=0),
        sa.Column('avg_competitor_price_cents', sa.Integer),
        sa.Column('sales_at_current', sa.Integer, default=0),
        sa.Column('predicted_sales_at_recommended', sa.Integer, default=0),
        sa.Column('predicted_revenue_lift', sa.Float, default=0.0),
        sa.Column('recommendation_reason', sa.Text),
        sa.Column('is_applied', sa.Integer, default=0),
        sa.Column('applied_at', sa.DateTime),
        sa.Column('generated_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_pricing_recommendations_book_id', 'pricing_recommendations', ['book_id'])
    
    # CourseModule
    op.create_table(
        'course_modules',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('author_id', sa.String(36), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('slug', sa.String(100), unique=True),
        sa.Column('lesson_count', sa.Integer, default=0),
        sa.Column('total_duration_minutes', sa.Integer, default=0),
        sa.Column('price_cents', sa.Integer),
        sa.Column('discount_percent', sa.Integer, default=0),
        sa.Column('is_published', sa.Integer, default=0),
        sa.Column('is_featured', sa.Integer, default=0),
        sa.Column('enrolled_count', sa.Integer, default=0),
        sa.Column('completion_rate', sa.Float, default=0.0),
        sa.Column('average_rating', sa.Float, default=0.0),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('published_at', sa.DateTime),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_course_modules_author_id', 'course_modules', ['author_id'])
    op.create_index('ix_course_modules_slug', 'course_modules', ['slug'])
    
    # PatronAccount
    op.create_table(
        'patron_accounts',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('creator_id', sa.String(36), nullable=False, unique=True),
        sa.Column('stripe_account_id', sa.String(100)),
        sa.Column('slug', sa.String(100), unique=True),
        sa.Column('tiers', sa.JSON),
        sa.Column('patron_count', sa.Integer, default=0),
        sa.Column('monthly_revenue_cents', sa.Integer, default=0),
        sa.Column('exclusive_posts_enabled', sa.Integer, default=0),
        sa.Column('discord_link', sa.String(500)),
        sa.Column('is_active', sa.Integer, default=1),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_patron_accounts_creator_id', 'patron_accounts', ['creator_id'])
    op.create_index('ix_patron_accounts_slug', 'patron_accounts', ['slug'])


def downgrade():
    """Drop monetization tables."""
    op.drop_table('patron_accounts')
    op.drop_table('course_modules')
    op.drop_table('pricing_recommendations')
    op.drop_table('affiliate_links')
    op.drop_table('marketplace_royalties')
    op.drop_table('author_subscriptions')
