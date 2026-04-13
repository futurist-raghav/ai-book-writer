"""
Email notification service for monetization events.

Handles sending emails for:
- Payout confirmations and transfers
- Tier upgrades and role changes
- Earnings updates and milestones
"""

import logging
from typing import Optional
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib

from app.models.user_model import User

logger = logging.getLogger(__name__)


class EmailNotificationService:
    """Service for sending monetization-related emails"""

    def __init__(
        self,
        smtp_server: str = "localhost",
        smtp_port: int = 587,
        from_email: str = "noreply@aiebookwriter.com",
        from_name: str = "Scribe House",
        use_tls: bool = True,
    ):
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.from_email = from_email
        self.from_name = from_name
        self.use_tls = use_tls

    def _send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        """Send email via SMTP"""
        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to_email
            msg["Subject"] = subject

            if text_content:
                msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                if self.use_tls:
                    server.starttls()
                # Note: In production, add authentication here
                # server.login(username, password)
                server.send_message(msg)

            logger.info(f"Email sent to {to_email}: {subject}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    def send_payout_initiated(
        self,
        user: User,
        payout_amount: Decimal,
        payout_date: datetime,
        destination: str,
    ) -> bool:
        """Send email when payout is initiated"""
        subject = f"Payout Initiated - ${payout_amount:.2f}"

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #1f2937;">Payout Initiated</h2>
                <p>Hello {user.first_name or user.username},</p>
                <p>Your payout has been initiated and is being processed.</p>
                
                <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Payout Details:</strong></p>
                    <p>Amount: <span style="font-size: 24px; color: #059669;">${payout_amount:.2f}</span></p>
                    <p>Date: {payout_date.strftime('%B %d, %Y')}</p>
                    <p>Destination: {destination}</p>
                </div>
                
                <p>You can track the status of your payout in your dashboard under <strong>Earnings → Payouts</strong>.</p>
                
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                    Questions? <a href="mailto:support@aiebookwriter.com">Contact our support team</a>
                </p>
            </body>
        </html>
        """

        text_content = f"""
        Payout Initiated

        Hello {user.first_name or user.username},

        Your payout of ${payout_amount:.2f} has been initiated and is being processed.

        Expected date: {payout_date.strftime('%B %d, %Y')}
        Destination: {destination}

        Track your payout status in your dashboard under Earnings → Payouts.
        """

        return self._send_email(user.email, subject, html_content, text_content)

    def send_payout_completed(
        self,
        user: User,
        payout_amount: Decimal,
        completion_date: datetime,
        destination: str,
        confirmation_id: str,
    ) -> bool:
        """Send email when payout is completed"""
        subject = f"Payout Completed - ${payout_amount:.2f}"

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #1f2937;">Payout Completed ✓</h2>
                <p>Hello {user.first_name or user.username},</p>
                <p>Great news! Your payout has been completed successfully.</p>
                
                <div style="background-color: #f0fdf4; padding: 16px; border-left: 4px solid #059669; margin: 20px 0;">
                    <p><strong>Payout Confirmation:</strong></p>
                    <p>Amount: <span style="font-size: 24px; color: #059669;">${payout_amount:.2f}</span></p>
                    <p>Date: {completion_date.strftime('%B %d, %Y')}</p>
                    <p>To: {destination}</p>
                    <p>Confirmation ID: <code style="background-color: #f3f4f6; padding: 4px 8px;">{confirmation_id}</code></p>
                </div>
                
                <p>The funds should appear in your account within 1-3 business days depending on your financial institution.</p>
                
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                    Questions? <a href="mailto:support@aiebookwriter.com">Contact our support team</a>
                </p>
            </body>
        </html>
        """

        text_content = f"""
        Payout Completed ✓

        Hello {user.first_name or user.username},

        Your payout of ${payout_amount:.2f} has been completed successfully!

        Completion date: {completion_date.strftime('%B %d, %Y')}
        To: {destination}
        Confirmation ID: {confirmation_id}

        The funds should appear in your account within 1-3 business days.
        """

        return self._send_email(user.email, subject, html_content, text_content)

    def send_payout_failed(
        self,
        user: User,
        payout_amount: Decimal,
        reason: str,
    ) -> bool:
        """Send email when payout fails"""
        subject = f"Payout Failed - ${payout_amount:.2f}"

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #1f2937;">Payout Failed</h2>
                <p>Hello {user.first_name or user.username},</p>
                <p>Unfortunately, your payout could not be processed.</p>
                
                <div style="background-color: #fef2f2; padding: 16px; border-left: 4px solid #dc2626; margin: 20px 0;">
                    <p><strong>Failed Payout:</strong></p>
                    <p>Amount: ${payout_amount:.2f}</p>
                    <p>Reason: {reason}</p>
                </div>
                
                <p>Please check your payment details and try again. Visit <strong>Earnings → Payment Methods</strong> to update your information.</p>
                
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                    Need help? <a href="mailto:support@aiebookwriter.com">Contact our support team</a> with your payout issue.
                </p>
            </body>
        </html>
        """

        text_content = f"""
        Payout Failed

        Hello {user.first_name or user.username},

        Unfortunately, your payout of ${payout_amount:.2f} could not be processed.

        Reason: {reason}

        Please check your payment details and try again. Visit Earnings → Payment Methods to update your information.
        """

        return self._send_email(user.email, subject, html_content, text_content)

    def send_tier_upgraded(
        self,
        user: User,
        new_tier: str,
        tier_benefits: list[str],
        effective_date: datetime,
    ) -> bool:
        """Send email when user tier is upgraded"""
        subject = f"Congratulations! You've Been Upgraded to {new_tier}"

        benefits_html = "\n".join(
            [f"<li>{benefit}</li>" for benefit in tier_benefits]
        )

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #1f2937;">🎉 Tier Upgraded</h2>
                <p>Hello {user.first_name or user.username},</p>
                <p>Congratulations! Your author tier has been upgraded to <strong>{new_tier}</strong>.</p>
                
                <div style="background-color: #eff6ff; padding: 16px; border-left: 4px solid #0284c7; margin: 20px 0;">
                    <p><strong>New Tier Benefits:</strong></p>
                    <ul>
                        {benefits_html}
                    </ul>
                </div>
                
                <p>Your new tier is effective as of {effective_date.strftime('%B %d, %Y')}.</p>
                
                <p>Visit your <strong>Dashboard → Author Profile</strong> to explore all your new features and opportunities.</p>
                
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                    Questions? <a href="mailto:support@aiebookwriter.com">Contact our support team</a>
                </p>
            </body>
        </html>
        """

        text_content = f"""
        🎉 Tier Upgraded

        Hello {user.first_name or user.username},

        Congratulations! Your author tier has been upgraded to {new_tier}.

        New Tier Benefits:
        {chr(10).join([f'- {benefit}' for benefit in tier_benefits])}

        Effective date: {effective_date.strftime('%B %d, %Y')}

        Explore all your new features in Dashboard → Author Profile.
        """

        return self._send_email(user.email, subject, html_content, text_content)

    def send_earnings_milestone(
        self,
        user: User,
        total_earnings: Decimal,
        milestone: Decimal,
    ) -> bool:
        """Send email when user reaches earnings milestone"""
        subject = f"Earnings Milestone Reached - ${milestone:.2f}!"

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #1f2937;">🏆 Earnings Milestone!</h2>
                <p>Hello {user.first_name or user.username},</p>
                <p>Fantastic news! Your total earnings have reached <strong>${milestone:.2f}</strong>!</p>
                
                <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Your Earnings:</strong></p>
                    <p style="font-size: 28px; color: #d97706; margin: 10px 0;">${total_earnings:.2f}</p>
                    <p style="color: #78350f;">Keep up the great work!</p>
                </div>
                
                <p>You're making an impact with your books. View your earnings breakdown and performance metrics in <strong>Dashboard → Earnings</strong>.</p>
                
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                    Share your success story with us! <a href="mailto:community@aiebookwriter.com">Contact our community team</a>
                </p>
            </body>
        </html>
        """

        text_content = f"""
        🏆 Earnings Milestone!

        Hello {user.first_name or user.username},

        Fantastic news! Your total earnings have reached ${milestone:.2f}!

        Total earnings: ${total_earnings:.2f}

        You're making an impact with your books. View your earnings breakdown and performance metrics in Dashboard → Earnings.

        Keep up the great work!
        """

        return self._send_email(user.email, subject, html_content, text_content)

    def send_earnings_summary(
        self,
        user: User,
        period: str,  # "monthly", "quarterly", "annual"
        earnings: Decimal,
        sales_count: int,
        top_book: Optional[str] = None,
    ) -> bool:
        """Send periodic earnings summary email"""
        period_display = {
            "monthly": "Monthly",
            "quarterly": "Quarterly",
            "annual": "Annual",
        }.get(period, "Earnings")

        subject = f"{period_display} Earnings Summary"

        top_book_section = f"""
        <p><strong>Top Performing Book:</strong></p>
        <p>{top_book}</p>
        """ if top_book else ""

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #1f2937;">{period_display} Earnings Summary</h2>
                <p>Hello {user.first_name or user.username},</p>
                <p>Here's your {period} earnings summary:</p>
                
                <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Total Earnings:</strong></p>
                    <p style="font-size: 28px; color: #059669; margin: 10px 0;">${earnings:.2f}</p>
                    <p>Sales: {sales_count}</p>
                    {top_book_section}
                </div>
                
                <p>View detailed analytics and insights in your <strong>Dashboard → Earnings</strong>.</p>
                
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                    Questions about your earnings? <a href="mailto:support@aiebookwriter.com">Contact support</a>
                </p>
            </body>
        </html>
        """

        text_content = f"""
        {period_display} Earnings Summary

        Hello {user.first_name or user.username},

        Total earnings: ${earnings:.2f}
        Sales: {sales_count}
        {f'Top book: {top_book}' if top_book else ''}

        View detailed analytics in Dashboard → Earnings.
        """

        return self._send_email(user.email, subject, html_content, text_content)
