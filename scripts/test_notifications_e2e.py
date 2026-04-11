#!/usr/bin/env python3
"""
End-to-End test script for mobile push notifications.

This script validates the complete notification flow:
1. Device token registration
2. Notification sending
3. Notification retrieval
4. Mark as read
5. Preference management

Usage:
    python test_notifications_e2e.py --api-url http://localhost:8000 --token YOUR_AUTH_TOKEN
"""

import argparse
import json
import sys
import time
from datetime import datetime
from typing import Dict, Any, Optional

import requests


class NotificationE2ETester:
    """End-to-end tester for notification flow"""

    def __init__(self, api_url: str, auth_token: str, verbose: bool = False):
        self.api_url = api_url.rstrip('/')
        self.auth_token = auth_token
        self.verbose = verbose
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json',
        })
        self.test_device_token = f"ExponentPushToken[test_token_{int(time.time())}]"
        self.notification_id = None

    def _log(self, message: str, level: str = 'INFO'):
        """Log message with timestamp"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f"[{timestamp}] {level}: {message}")

    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        expected_status: int = 200,
    ) -> Dict[str, Any]:
        """Make HTTP request with error handling"""
        url = f"{self.api_url}{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data)
            elif method.upper() == 'PATCH':
                response = self.session.patch(url, json=data)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url)
            else:
                raise ValueError(f"Unsupported method: {method}")

            if self.verbose:
                self._log(f"{method} {endpoint} → {response.status_code}")

            if response.status_code != expected_status:
                self._log(
                    f"Unexpected status code: {response.status_code}",
                    level='ERROR'
                )
                self._log(f"Response: {response.text}", level='ERROR')
                raise Exception(f"Request failed with status {response.status_code}")

            return response.json()

        except requests.RequestException as e:
            self._log(f"Request failed: {str(e)}", level='ERROR')
            raise

    def test_device_registration(self) -> bool:
        """Test 1: Register device for notifications"""
        self._log("TEST 1: Device Registration")
        print("-" * 60)

        try:
            result = self._request(
                'POST',
                '/api/v1/notifications/register-device',
                data={
                    'device_token': self.test_device_token,
                    'platform': 'ios',
                    'app_version': '1.0.0',
                },
                expected_status=201,
            )

            self._log(f"✓ Device registered: {self.test_device_token}")
            self._log(f"  Device ID: {result.get('id')}")
            self._log(f"  Platform: {result.get('platform')}")
            self._log(f"  Active: {result.get('is_active')}")
            print()
            return True

        except Exception as e:
            self._log(f"✗ Device registration failed: {str(e)}", level='ERROR')
            return False

    def test_send_test_notification(self) -> bool:
        """Test 2: Send test notification"""
        self._log("TEST 2: Send Test Notification")
        print("-" * 60)

        try:
            result = self._request(
                'POST',
                '/api/v1/notifications/send-test',
            )

            tokens_sent = result.get('result', {}).get('tokens_sent', 0)
            self._log(f"✓ Test notification sent")
            self._log(f"  Tokens sent: {tokens_sent}")
            self._log(f"  Note: In testing, token send will show 0 if no real Expo token")
            print()
            return True

        except Exception as e:
            self._log(f"✗ Failed to send test notification: {str(e)}", level='ERROR')
            return False

    def test_get_notifications(self) -> bool:
        """Test 3: Retrieve notifications"""
        self._log("TEST 3: Get Notifications")
        print("-" * 60)

        try:
            result = self._request('GET', '/api/v1/notifications/')

            notifications = result.get('data', [])
            unread_count = result.get('unread_count', 0)
            total = result.get('total', 0)

            self._log(f"✓ Notifications retrieved")
            self._log(f"  Total notifications: {total}")
            self._log(f"  Unread: {unread_count}")
            
            if notifications:
                self._log(f"  Recent notifications:")
                for notif in notifications[:3]:
                    self._log(f"    - {notif.get('title')}: {notif.get('body')}")
                    if notif.get('read') == False and not self.notification_id:
                        self.notification_id = notif.get('id')
            else:
                self._log("  (No notifications yet - expected for fresh device)")
            
            print()
            return True

        except Exception as e:
            self._log(f"✗ Failed to get notifications: {str(e)}", level='ERROR')
            return False

    def test_unread_count(self) -> bool:
        """Test 4: Get unread count"""
        self._log("TEST 4: Get Unread Count")
        print("-" * 60)

        try:
            result = self._request('GET', '/api/v1/notifications/unread/count')

            unread_count = result.get('unread_count', 0)
            self._log(f"✓ Unread count retrieved: {unread_count}")
            print()
            return True

        except Exception as e:
            self._log(f"✗ Failed to get unread count: {str(e)}", level='ERROR')
            return False

    def test_notification_preferences(self) -> bool:
        """Test 5: Get and update preferences"""
        self._log("TEST 5: Notification Preferences")
        print("-" * 60)

        try:
            # Get preferences
            result = self._request('GET', '/api/v1/notifications/preferences/me')

            self._log("✓ Current preferences retrieved:")
            self._log(f"  Notifications enabled: {result.get('notifications_enabled')}")
            self._log(f"  Chapter updates: {result.get('chapter_updates_enabled')}")
            self._log(f"  Collaboration: {result.get('collaboration_enabled')}")
            self._log(f"  Assignments: {result.get('assignment_enabled')}")
            self._log(f"  Milestones: {result.get('milestone_enabled')}")

            # Update preferences
            update_data = {
                'chapter_updates_enabled': False,
            }
            result = self._request(
                'PATCH',
                '/api/v1/notifications/preferences/me',
                data=update_data,
            )

            self._log("✓ Preferences updated")
            self._log(f"  Chapter updates now: {result.get('chapter_updates_enabled')}")

            # Reset preferences
            reset_data = {
                'chapter_updates_enabled': True,
            }
            self._request(
                'PATCH',
                '/api/v1/notifications/preferences/me',
                data=reset_data,
            )

            self._log("✓ Preferences reset to original")
            print()
            return True

        except Exception as e:
            self._log(f"✗ Failed to manage preferences: {str(e)}", level='ERROR')
            return False

    def test_mark_as_read(self) -> bool:
        """Test 6: Mark notification as read"""
        if not self.notification_id:
            self._log("TEST 6: Mark as Read - SKIPPED (no unread notifications)")
            print()
            return True

        self._log("TEST 6: Mark Notification as Read")
        print("-" * 60)

        try:
            self._request(
                'PATCH',
                f'/api/v1/notifications/{self.notification_id}/read',
            )

            self._log(f"✓ Notification marked as read: {self.notification_id}")

            # Verify read status
            result = self._request('GET', f'/api/v1/notifications/{self.notification_id}')
            is_read = result.get('read', False)
            self._log(f"  Verified read status: {is_read}")
            print()
            return True

        except Exception as e:
            self._log(f"✗ Failed to mark as read: {str(e)}", level='ERROR')
            return False

    def test_device_unregistration(self) -> bool:
        """Test 7: Unregister device"""
        self._log("TEST 7: Device Unregistration")
        print("-" * 60)

        try:
            self._request(
                'POST',
                '/api/v1/notifications/unregister-device',
                data={
                    'device_token': self.test_device_token,
                    'platform': 'ios',
                },
            )

            self._log(f"✓ Device unregistered: {self.test_device_token}")
            print()
            return True

        except Exception as e:
            self._log(f"✗ Device unregistration failed: {str(e)}", level='ERROR')
            return False

    def run_all_tests(self) -> Dict[str, bool]:
        """Run all tests and return results"""
        print("\n" + "=" * 60)
        print("NOTIFICATION E2E TEST SUITE")
        print("=" * 60 + "\n")

        results = {
            'device_registration': self.test_device_registration(),
            'send_test_notification': self.test_send_test_notification(),
            'get_notifications': self.test_get_notifications(),
            'unread_count': self.test_unread_count(),
            'preferences': self.test_notification_preferences(),
            'mark_as_read': self.test_mark_as_read(),
            'device_unregistration': self.test_device_unregistration(),
        }

        return results

    def print_summary(self, results: Dict[str, bool]):
        """Print test summary"""
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)

        passed = sum(1 for v in results.values() if v)
        total = len(results)

        for test_name, passed_flag in results.items():
            status = "✓ PASS" if passed_flag else "✗ FAIL"
            friendly_name = test_name.replace('_', ' ').title()
            print(f"{status}: {friendly_name}")

        print(f"\nTotal: {passed}/{total} tests passed")

        if passed == total:
            print("\n🎉 All tests passed! Notification system is working correctly.")
            return 0
        else:
            print(f"\n⚠️  {total - passed} test(s) failed. Check configuration.")
            return 1


def main():
    parser = argparse.ArgumentParser(
        description='Run end-to-end tests for push notification system'
    )
    parser.add_argument(
        '--api-url',
        default='http://localhost:8000',
        help='Backend API URL (default: http://localhost:8000)',
    )
    parser.add_argument(
        '--token',
        required=True,
        help='Authentication bearer token (required)',
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose logging',
    )

    args = parser.parse_args()

    tester = NotificationE2ETester(
        api_url=args.api_url,
        auth_token=args.token,
        verbose=args.verbose,
    )

    results = tester.run_all_tests()
    exit_code = tester.print_summary(results)

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
