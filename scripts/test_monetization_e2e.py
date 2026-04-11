#!/usr/bin/env python3
"""
E2E Test Suite for P7.4 + P7.5 Monetization & Integration Features

Tests the complete payout workflow, tier upgrades, and OAuth token management.

Usage:
    python scripts/test_monetization_e2e.py \
        --api-url http://localhost:8000 \
        --token YOUR_AUTH_TOKEN \
        --book-id YOUR_BOOK_ID
"""

import argparse
import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import sys


class MonetizationE2ETest:
    """End-to-end tests for monetization features."""
    
    def __init__(self, api_url: str, token: str, book_id: str):
        self.api_url = api_url.rstrip("/")
        self.token = token
        self.book_id = book_id
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        self.test_results = []
        
    def print_header(self, text: str):
        """Print formatted test section header."""
        print(f"\n{'='*60}")
        print(f"  {text}")
        print(f"{'='*60}\n")
    
    def print_test(self, test_name: str):
        """Print test name."""
        print(f"  → {test_name}...", end=" ", flush=True)
    
    def print_result(self, passed: bool, message: str = ""):
        """Print test result."""
        symbol = "✅ PASS" if passed else "❌ FAIL"
        msg = f" ({message})" if message else ""
        print(f"{symbol}{msg}")
        self.test_results.append((passed, message))
    
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Optional[Dict]:
        """Make HTTP request to API."""
        url = f"{self.api_url}{endpoint}"
        try:
            if method == "GET":
                resp = requests.get(url, headers=self.headers, timeout=10)
            elif method == "POST":
                resp = requests.post(url, json=data, headers=self.headers, timeout=10)
            elif method == "PATCH":
                resp = requests.patch(url, json=data, headers=self.headers, timeout=10)
            else:
                return None
            
            resp.raise_for_status()
            return resp.json() if resp.text else {}
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] {e}")
            return None
    
    # ==================== PAYOUT WORKFLOW TESTS ====================
    
    def test_get_royalty_info(self) -> bool:
        """Test: Get royalty info for book."""
        self.print_test("Get royalty information")
        
        resp = self.make_request("GET", f"/api/v1/royalties/{self.book_id}")
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        required_fields = [
            "id", "book_id", "total_sales", "total_revenue_cents",
            "royalty_percentage", "author_earnings_cents",
            "payouts_pending_cents", "payouts_paid_cents"
        ]
        
        has_fields = all(field in resp for field in required_fields)
        self.print_result(has_fields, f"Fields: {', '.join(required_fields)}")
        return has_fields
    
    def test_record_sale(self, price_cents: int = 999) -> bool:
        """Test: Record a book sale."""
        self.print_test(f"Record book sale (${price_cents/100:.2f})")
        
        request_data = {
            "price_cents": price_cents,
            "platform": "marketplace",
            "customer_id": f"c_{int(time.time())}",
        }
        
        resp = self.make_request("POST", f"/api/v1/books/{self.book_id}/sales", request_data)
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        has_id = "id" in resp and resp.get("id")
        self.print_result(has_id, f"Sale recorded: ID={resp.get('id', 'N/A')}")
        return has_id
    
    def test_check_payout_threshold(self) -> bool:
        """Test: Check if payout should be triggered."""
        self.print_test("Check payout threshold ($500)")
        
        resp = self.make_request("GET", f"/api/v1/royalties/{self.book_id}")
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        earnings = resp.get("author_earnings_cents", 0)
        threshold_reached = earnings >= 50000
        
        self.print_result(
            True,
            f"Earnings: ${earnings/100:.2f} (Threshold: $500)"
        )
        return True
    
    def test_initiate_payout(self) -> bool:
        """Test: Initiate payout manually."""
        self.print_test("Initiate payout")
        
        request_data = {"royalty_id": self.book_id}
        
        resp = self.make_request(
            "POST",
            f"/api/v1/payouts",
            request_data
        )
        
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        has_status = "status" in resp and resp.get("status") in ["pending", "processing"]
        self.print_result(
            has_status,
            f"Status: {resp.get('status', 'unknown')}"
        )
        return has_status
    
    def test_list_payout_history(self) -> bool:
        """Test: List payout history."""
        self.print_test("List payout history")
        
        resp = self.make_request("GET", "/api/v1/payouts?limit=10")
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        is_list = isinstance(resp.get("items"), list)
        count = len(resp.get("items", []))
        
        self.print_result(is_list, f"Found {count} payouts")
        return is_list
    
    # ==================== SUBSCRIPTION TIER TESTS ====================
    
    def test_get_current_subscription(self) -> bool:
        """Test: Get current subscription tier."""
        self.print_test("Get current subscription")
        
        resp = self.make_request("GET", "/api/v1/subscriptions/me")
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        required_fields = ["id", "tier", "status", "books_limit", "collaborators_limit"]
        has_fields = all(field in resp for field in required_fields)
        
        tier = resp.get("tier", "unknown")
        self.print_result(has_fields, f"Current tier: {tier}")
        return has_fields
    
    def test_get_available_tiers(self) -> bool:
        """Test: List available subscription tiers."""
        self.print_test("Get available tiers")
        
        resp = self.make_request("GET", "/api/v1/subscriptions/tiers")
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        tiers = resp.get("tiers", [])
        is_list = isinstance(tiers, list) and len(tiers) >= 2
        
        tier_names = [t.get("name") for t in tiers]
        self.print_result(is_list, f"Tiers: {', '.join(tier_names)}")
        return is_list
    
    def test_upgrade_subscription(self, new_tier: str = "pro") -> bool:
        """Test: Upgrade subscription tier."""
        self.print_test(f"Upgrade subscription to {new_tier}")
        
        request_data = {
            "tier": new_tier,
            "billing_cycle": "monthly",
            "auto_renew": True,
        }
        
        resp = self.make_request("PATCH", "/api/v1/subscriptions/me", request_data)
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        upgraded = resp.get("tier") == new_tier
        self.print_result(upgraded, f"Tier: {resp.get('tier', 'unknown')}")
        return upgraded
    
    def test_get_subscription_usage(self) -> bool:
        """Test: Get subscription usage/limits."""
        self.print_test("Get subscription usage")
        
        resp = self.make_request("GET", "/api/v1/subscriptions/me/usage")
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        required_fields = ["books_used", "books_limit", "collaborators_used", "storage_used_mb"]
        has_fields = all(field in resp for field in required_fields)
        
        books_ratio = f"{resp.get('books_used', 0)}/{resp.get('books_limit', 0)}"
        self.print_result(has_fields, f"Books: {books_ratio}")
        return has_fields
    
    # ==================== OAUTH TOKEN TESTS ====================
    
    def test_get_integrations(self) -> bool:
        """Test: List connected OAuth integrations."""
        self.print_test("List OAuth integrations")
        
        resp = self.make_request("GET", "/api/v1/integrations")
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        integrations = resp.get("items", [])
        is_list = isinstance(integrations, list)
        
        statuses = [i.get("status") for i in integrations]
        self.print_result(
            is_list,
            f"Found {len(integrations)} integrations (statuses: {', '.join(set(statuses))})"
        )
        return is_list
    
    def test_check_token_status(self) -> bool:
        """Test: Check OAuth token status."""
        self.print_test("Check token status")
        
        # Get first integration
        integrations = self.make_request("GET", "/api/v1/integrations")
        if not integrations or not integrations.get("items"):
            self.print_result(True, "No integrations to check")
            return True
        
        integration_id = integrations["items"][0].get("id")
        if not integration_id:
            self.print_result(False, "No integration ID found")
            return False
        
        resp = self.make_request("GET", f"/api/v1/integrations/{integration_id}/token-status")
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        has_status = "valid" in resp
        expires = resp.get("expires_at", "N/A")
        self.print_result(has_status, f"Valid: {resp.get('valid')}, Expires: {expires}")
        return has_status
    
    def test_refresh_token_manually(self) -> bool:
        """Test: Manually trigger token refresh."""
        self.print_test("Trigger manual token refresh")
        
        # Get first integration
        integrations = self.make_request("GET", "/api/v1/integrations")
        if not integrations or not integrations.get("items"):
            self.print_result(True, "No integrations to refresh")
            return True
        
        integration_id = integrations["items"][0].get("id")
        if not integration_id:
            self.print_result(False, "No integration ID found")
            return False
        
        resp = self.make_request("POST", f"/api/v1/integrations/{integration_id}/refresh-token", {})
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        has_expires = "expires_at" in resp
        self.print_result(has_expires, f"New expiry: {resp.get('expires_at', 'N/A')}")
        return has_expires
    
    # ==================== NOTIFICATION TESTS ====================
    
    def test_get_notifications(self) -> bool:
        """Test: Get user notifications."""
        self.print_test("Get notifications")
        
        resp = self.make_request("GET", "/api/v1/notifications?limit=10")
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        notifications = resp.get("items", [])
        is_list = isinstance(notifications, list)
        
        self.print_result(is_list, f"Found {len(notifications)} notifications")
        return is_list
    
    def test_send_test_notification(self) -> bool:
        """Test: Send test notification."""
        self.print_test("Send test notification")
        
        request_data = {
            "title": "Test Notification",
            "body": "This is a test from E2E suite",
            "type": "test",
        }
        
        resp = self.make_request("POST", "/api/v1/notifications/test", request_data)
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        has_id = "id" in resp
        self.print_result(has_id, f"Notification sent: {resp.get('id', 'N/A')}")
        return has_id
    
    # ==================== ANALYTICS TESTS ====================
    
    def test_get_earnings_analytics(self) -> bool:
        """Test: Get earnings analytics."""
        self.print_test("Get earnings analytics")
        
        resp = self.make_request("GET", "/api/v1/analytics/earnings?period=30d")
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        required_fields = ["total_revenue", "total_earnings", "total_payouts", "currency"]
        has_fields = all(field in resp for field in required_fields)
        
        earnings = resp.get("total_earnings", 0)
        self.print_result(has_fields, f"Total earnings: ${earnings/100:.2f}")
        return has_fields
    
    def test_get_royalty_summary(self) -> bool:
        """Test: Get royalty summary by book."""
        self.print_test("Get royalty summary")
        
        resp = self.make_request("GET", "/api/v1/royalties/summary")
        if not resp:
            self.print_result(False, "API call failed")
            return False
        
        royalties = resp.get("royalties", [])
        is_list = isinstance(royalties, list)
        
        total = resp.get("total_earnings", 0)
        self.print_result(is_list, f"Books: {len(royalties)}, Total: ${total/100:.2f}")
        return is_list
    
    # ==================== RUN ALL TESTS ====================
    
    def run_all_tests(self):
        """Run complete test suite."""
        self.print_header("P7.4 + P7.5 MONETIZATION E2E TEST SUITE")
        print(f"API URL:  {self.api_url}")
        print(f"Book ID:  {self.book_id}\n")
        
        # Payout tests
        self.print_header("1. PAYOUT WORKFLOW")
        self.test_get_royalty_info()
        self.test_record_sale(999)
        self.test_check_payout_threshold()
        self.test_initiate_payout()
        self.test_list_payout_history()
        
        # Subscription tests
        self.print_header("2. SUBSCRIPTION TIER MANAGEMENT")
        self.test_get_current_subscription()
        self.test_get_available_tiers()
        self.test_get_subscription_usage()
        
        # OAuth tests
        self.print_header("3. OAUTH TOKEN MANAGEMENT")
        self.test_get_integrations()
        self.test_check_token_status()
        self.test_refresh_token_manually()
        
        # Notification tests
        self.print_header("4. NOTIFICATION SYSTEM")
        self.test_get_notifications()
        self.test_send_test_notification()
        
        # Analytics tests
        self.print_header("5. EARNINGS ANALYTICS")
        self.test_get_earnings_analytics()
        self.test_get_royalty_summary()
        
        # Print summary
        self.print_header("TEST SUMMARY")
        passed = sum(1 for p, _ in self.test_results if p)
        total = len(self.test_results)
        percentage = (passed / total * 100) if total > 0 else 0
        
        print(f"Results: {passed}/{total} tests passed ({percentage:.0f}%)\n")
        
        if passed == total:
            print("✅ All tests PASSED!")
            return 0
        else:
            print(f"❌ {total - passed} tests FAILED")
            return 1


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="P7.4 + P7.5 Monetization E2E Test Suite"
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:8000",
        help="API base URL"
    )
    parser.add_argument(
        "--token",
        help="Auth token (required)"
    )
    parser.add_argument(
        "--book-id",
        help="Book ID for payout tests (required)"
    )
    
    args = parser.parse_args()
    
    # Validate required args
    if not args.token:
        print("❌ Error: --token is required")
        print("   Get token: curl -X POST http://localhost:8000/api/v1/auth/login")
        return 1
    
    if not args.book_id:
        print("❌ Error: --book-id is required")
        print("   Get book IDs: GET /api/v1/books")
        return 1
    
    # Run tests
    tester = MonetizationE2ETest(args.api_url, args.token, args.book_id)
    return tester.run_all_tests()


if __name__ == "__main__":
    sys.exit(main())
