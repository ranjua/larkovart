#!/usr/bin/env python3
"""
Simple test runner for Larkova Art Website
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """Run a command and return success status"""
    print(f"\n🔧 {description}...")
    try:
        subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        print("✅ Success")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed: {e.stderr}")
        return False

def main():
    print("🖼️  Larkova Art Website Test Runner")
    print("=" * 40)

    # Check if we're in the right directory
    if not os.path.exists('requirements.txt'):
        print("❌ requirements.txt not found. Please run from the test directory.")
        return 1

    # Install dependencies
    if not run_command("pipenv install -r requirements.txt", "Installing Python dependencies"):
        return 1

    # Install Playwright browsers
    if not run_command("pipenv run playwright install", "Installing Playwright browsers"):
        return 1

    # Run the tests
    if not run_command("pipenv run python test_website.py", "Running website validation tests"):
        return 1

    print("\n🎉 All tests completed successfully!")
    return 0

if __name__ == "__main__":
    sys.exit(main())