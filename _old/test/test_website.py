#!/usr/bin/env python3
"""
Larkova Art Website Structure Validation Tests
Using Playwright to test actual website behavior
"""

import json
import asyncio
import sys
import os
import subprocess
import time
from playwright.async_api import async_playwright

class WebsiteTester:
    def __init__(self, base_url="http://localhost:8000", config_path=None):
        self.base_url = base_url
        if config_path is None:
            # Get the directory of the test file and go up one level
            test_dir = os.path.dirname(os.path.abspath(__file__))
            config_path = os.path.join(os.path.dirname(test_dir), 'config.json')
        self.config_path = config_path
        self.config = None
        self.browser = None
        self.context = None
        self.page = None
        self.server_process = None

    async def setup(self):
        """Setup Playwright browser and start local server"""
        # Load config
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
            print("✅ Config loaded successfully")
        except Exception as e:
            print(f"❌ Failed to load config: {e}")
            return False

        # Start local server
        try:
            self.server_process = subprocess.Popen(
                ['python', '-m', 'http.server', '8000'],
                cwd=os.path.dirname(self.config_path),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            # Wait for server to start
            time.sleep(2)
            print("✅ Local server started")
        except Exception as e:
            print(f"❌ Failed to start server: {e}")
            return False

        # Setup Playwright
        try:
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch()
            self.context = await self.browser.new_context()
            self.page = await self.context.new_page()
            print("✅ Playwright browser started")
            return True
        except Exception as e:
            print(f"❌ Failed to setup Playwright: {e}")
            return False

    async def teardown(self):
        """Cleanup resources"""
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.server_process:
            self.server_process.terminate()
            self.server_process.wait()
        print("✅ Cleanup completed")

    async def test_page_exists_and_title(self, path, expected_title):
        """Test if a page exists and has expected title"""
        try:
            url = f"{self.base_url}/{path}"
            await self.page.goto(url)
            await self.page.wait_for_load_state('networkidle')

            title = await self.page.title()
            if title != expected_title:
                print(f"❌ {path}: Title mismatch. Expected: '{expected_title}', Got: '{title}'")
                return False

            print(f"✅ {path}: Page exists with correct title")
            return True
        except Exception as e:
            print(f"❌ {path}: Page failed to load - {e}")
            return False

    async def test_meta_description(self, path, expected_description):
        """Test if page has correct meta description"""
        try:
            url = f"{self.base_url}/{path}"
            await self.page.goto(url)
            await self.page.wait_for_load_state('networkidle')

            meta_desc = await self.page.locator('meta[name="description"]').get_attribute('content')
            if meta_desc != expected_description:
                print(f"❌ {path}: Meta description mismatch. Expected: '{expected_description}', Got: '{meta_desc}'")
                return False

            print(f"✅ {path}: Meta description correct")
            return True
        except Exception as e:
            print(f"❌ {path}: Meta description test failed - {e}")
            return False

    async def test_element_text(self, path, selector, expected_text):
        """Test if element contains expected text"""
        try:
            url = f"{self.base_url}/{path}"
            await self.page.goto(url)
            await self.page.wait_for_load_state('networkidle')

            # Wait for JavaScript to populate content
            await self.page.wait_for_timeout(2000)

            element = self.page.locator(selector).first
            actual_text = await element.text_content()

            if actual_text.strip() != expected_text.strip():
                print(f"❌ {path}: Text mismatch in '{selector}'. Expected: '{expected_text}', Got: '{actual_text}'")
                return False

            print(f"✅ {path}: Element '{selector}' has correct text")
            return True
        except Exception as e:
            print(f"❌ {path}: Element text test failed - {e}")
            return False

    async def test_header_present(self, path):
        """Test if header/navbar is present on the page"""
        try:
            url = f"{self.base_url}/{path}"
            await self.page.goto(url)
            await self.page.wait_for_load_state('networkidle')

            # Check if navbar exists
            navbar = self.page.locator('.navbar')
            navbar_count = await navbar.count()

            if navbar_count == 0:
                print(f"❌ {path}: Header/navbar not found on page")
                return False

            # Check if logo exists
            logo = self.page.locator('.navbar .logo')
            logo_count = await logo.count()

            if logo_count == 0:
                print(f"❌ {path}: Logo not found in header")
                return False

            # Check if nav menu exists
            nav_menu = self.page.locator('.navbar .nav-menu')
            nav_menu_count = await nav_menu.count()

            if nav_menu_count == 0:
                print(f"❌ {path}: Navigation menu not found in header")
                return False

            print(f"✅ {path}: Header is present and contains logo and navigation")
            return True
        except Exception as e:
            print(f"❌ {path}: Header presence test failed - {e}")
            return False

    async def test_gallery_image_count(self, path, expected_count):
        """Test if gallery has expected number of images"""
        try:
            url = f"{self.base_url}/{path}"
            await self.page.goto(url)
            await self.page.wait_for_load_state('networkidle')

            # Wait for images to load
            await self.page.wait_for_timeout(1000)

            gallery_items = self.page.locator('.gallery-item')
            count = await gallery_items.count()

            if count != expected_count:
                print(f"❌ {path}: Gallery image count mismatch. Expected: {expected_count}, Got: {count}")
                return False

            print(f"✅ {path}: Gallery has correct image count ({expected_count})")
            return True
        except Exception as e:
            print(f"❌ {path}: Gallery test failed - {e}")
            return False

    async def test_social_media_links(self, path):
        """Test social media links work"""
        try:
            url = f"{self.base_url}/{path}"
            await self.page.goto(url)
            await self.page.wait_for_load_state('networkidle')

            expected_social = self.config['general']['socialMedia']

            # Check header social media
            nav_social_links = self.page.locator('.nav-social a')
            nav_count = await nav_social_links.count()

            if nav_count != len(expected_social):
                print(f"❌ {path}: Header social media count mismatch. Expected: {len(expected_social)}, Got: {nav_count}")
                return False

            # Check footer social media
            footer_social_links = self.page.locator('footer .social-link')
            footer_count = await footer_social_links.count()

            if footer_count != len(expected_social):
                print(f"❌ {path}: Footer social media count mismatch. Expected: {len(expected_social)}, Got: {footer_count}")
                return False

            # Check URLs match config
            for i, social in enumerate(expected_social):
                nav_href = await nav_social_links.nth(i).get_attribute('href')
                footer_href = await footer_social_links.nth(i).get_attribute('href')

                if nav_href != social['url']:
                    print(f"❌ {path}: Header social media URL mismatch for {social['platform']}")
                    return False
                if footer_href != social['url']:
                    print(f"❌ {path}: Footer social media URL mismatch for {social['platform']}")
                    return False

            print(f"✅ {path}: Social media links correct")
            return True
        except Exception as e:
            print(f"❌ {path}: Social media test failed - {e}")
            return False

    async def test_navigation_links(self):
        """Test that navigation links work"""
        try:
            await self.page.goto(f"{self.base_url}/index.html")
            await self.page.wait_for_load_state('networkidle')

            nav_links = self.page.locator('.nav-menu a')
            link_count = await nav_links.count()

            expected_nav = self.config['general']['navigation']

            if link_count != len(expected_nav):
                print(f"❌ Navigation: Link count mismatch. Expected: {len(expected_nav)}, Got: {link_count}")
                return False

            # Test each navigation link
            for i, nav_item in enumerate(expected_nav):
                link_href = await nav_links.nth(i).get_attribute('href')
                expected_href = nav_item['url']

                if link_href != expected_href:
                    print(f"❌ Navigation: Link {i} href mismatch. Expected: {expected_href}, Got: {link_href}")
                    return False

                # Try to navigate to the link (don't actually click to avoid page changes)
                link_url = f"{self.base_url}/{expected_href}"
                response = await self.page.request.get(link_url)
                if response.status != 200:
                    print(f"❌ Navigation: Link {expected_href} returns status {response.status}")
                    return False

            print("✅ Navigation links work correctly")
            return True
        except Exception as e:
            print(f"❌ Navigation test failed - {e}")
            return False

    async def test_broken_links(self):
        """Test for broken links on the homepage"""
        try:
            await self.page.goto(f"{self.base_url}/index.html")
            await self.page.wait_for_load_state('networkidle')

            # Get all links
            links = self.page.locator('a')
            link_count = await links.count()

            broken_links = []

            for i in range(link_count):
                href = await links.nth(i).get_attribute('href')
                if href and not href.startswith('#') and not href.startswith('mailto:'):
                    try:
                        if href.startswith('http'):
                            full_url = href
                        else:
                            full_url = f"{self.base_url}/{href}"

                        response = await self.page.request.get(full_url)
                        if response.status >= 400:
                            broken_links.append(f"{href} (status: {response.status})")
                    except Exception as e:
                        broken_links.append(f"{href} (error: {str(e)})")

            if broken_links:
                print(f"❌ Found {len(broken_links)} broken links: {', '.join(broken_links)}")
                return False

            print("✅ No broken links found")
            return True
        except Exception as e:
            print(f"❌ Broken links test failed - {e}")
            return False

async def main():
    print("🖼️  Larkova Art Website Structure Validation Tests")
    print("=" * 50)

    tester = WebsiteTester()

    if not await tester.setup():
        await tester.teardown()
        sys.exit(1)

    results = []

    try:
        # Test basic structure
        print("\n📋 Testing Basic Structure...")

        # Test homepage
        results.append(await tester.test_page_exists_and_title('index.html', tester.config['general']['siteTitle']))
        results.append(await tester.test_meta_description('index.html', tester.config['general']['metaDescription']))

        # Test hero section
        results.append(await tester.test_element_text('index.html', '.hero h1', tester.config['general']['heroTitle']))
        results.append(await tester.test_element_text('index.html', '.hero p', tester.config['general']['heroSubtitle']))

        # Test bio preview
        results.append(await tester.test_element_text('index.html', '.bio h2', tester.config['general']['bioPreview']['title']))

        # Test social media
        results.append(await tester.test_social_media_links('index.html'))

        # Test navigation
        results.append(await tester.test_navigation_links())

        # Test header presence
        results.append(await tester.test_header_present('index.html'))

        # Test broken links
        results.append(await tester.test_broken_links())

        # Test individual pages
        print("\n📄 Testing Individual Pages...")

        # Bio page
        bio_title = f"{tester.config['pages']['bio']['title']} - {tester.config['general']['siteTitle']}"
        results.append(await tester.test_page_exists_and_title('bio.html', bio_title))
        results.append(await tester.test_header_present('bio.html'))
        results.append(await tester.test_meta_description('bio.html', tester.config['pages']['bio']['description']))
        results.append(await tester.test_element_text('bio.html', 'h2', tester.config['pages']['bio']['title']))

        # Paintings page
        paintings_title = f"{tester.config['pages']['paintings']['title']} - {tester.config['general']['siteTitle']}"
        results.append(await tester.test_page_exists_and_title('paintings.html', paintings_title))
        results.append(await tester.test_header_present('paintings.html'))
        results.append(await tester.test_meta_description('paintings.html', tester.config['pages']['paintings']['description']))

        if 'paintings' in tester.config['assets'] and 'images' in tester.config['assets']['paintings']:
            paintings_count = len(tester.config['assets']['paintings']['images'])
            results.append(await tester.test_gallery_image_count('paintings.html', paintings_count))

        # Drawings page
        drawings_title = f"{tester.config['pages']['drawings']['title']} - {tester.config['general']['siteTitle']}"
        results.append(await tester.test_page_exists_and_title('drawings.html', drawings_title))
        results.append(await tester.test_header_present('drawings.html'))
        results.append(await tester.test_meta_description('drawings.html', tester.config['pages']['drawings']['description']))

        if 'drawings' in tester.config['assets'] and 'images' in tester.config['assets']['drawings']:
            drawings_count = len(tester.config['assets']['drawings']['images'])
            results.append(await tester.test_gallery_image_count('drawings.html', drawings_count))

        # Sculptures page
        sculptures_title = f"{tester.config['pages']['sculptures']['title']} - {tester.config['general']['siteTitle']}"
        results.append(await tester.test_page_exists_and_title('sculptures.html', sculptures_title))
        results.append(await tester.test_header_present('sculptures.html'))
        results.append(await tester.test_meta_description('sculptures.html', tester.config['pages']['sculptures']['description']))

        if 'sculptures' in tester.config['assets'] and 'images' in tester.config['assets']['sculptures']:
            sculptures_count = len(tester.config['assets']['sculptures']['images'])
            results.append(await tester.test_gallery_image_count('sculptures.html', sculptures_count))

        # Summary
        print("\n" + "=" * 50)
        passed = sum(results)
        total = len(results)
        print(f"📊 Test Results: {passed}/{total} tests passed")

        if passed == total:
            print("🎉 All tests passed! Website structure and behavior is valid.")
            return 0
        else:
            print("❌ Some tests failed. Please check the output above.")
            return 1

    finally:
        await tester.teardown()

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))