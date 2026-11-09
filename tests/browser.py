"""Browser acceptance checks against an isolated local DEVELOPMENT database."""
import json
import os
import signal
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:3200'

def run():
    with tempfile.TemporaryDirectory(prefix='larkovart-dev-browser-') as directory:
        env = {**os.environ, 'DATABASE_URL': f'file:{directory}/test.db',
               'DATABASE_ENVIRONMENT': 'development', 'RESEND_API_KEY': 're_test_local_only', 'LARKOVART_TEST_EMAIL_CAPTURE': str(Path(directory)/'email.json'), 'NODE_OPTIONS': '--import='+str(ROOT/'tests/helpers/resend-fetch.mjs'),
               'OPENAI_API_KEY': '', 'OPENAI_TEXT_MODEL': '', 'LARKOVART_BROWSER_TEST':''}
        with open(Path(directory)/'server.log', 'w+') as log:
            server = subprocess.Popen(['npm', 'run', 'start', '--', '--port', '3200'],
                cwd=ROOT, env=env, stdout=log, stderr=log, start_new_session=True)
            try:
                for _ in range(120):
                    if server.poll() is not None:
                        raise RuntimeError('Development test server exited.')
                    try:
                        if urlopen(BASE+'/en', timeout=15).status == 200:
                            break
                    except Exception:
                        time.sleep(0.5)
                else:
                    raise RuntimeError('Development server did not become ready.')
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True, args=['--disable-gpu'])
                    page = browser.new_page(viewport={'width':1440, 'height':1050})
                    errors = []
                    page.on('pageerror', lambda e: errors.append(str(e)))
                    # Every locale renders the real catalog and correct language.
                    for locale in ['es', 'en', 'ru', 'zh', 'ja', 'pt']:
                        print('Checking desktop locale:', locale, flush=True)
                        response = page.goto(BASE+'/'+locale, wait_until='networkidle')
                        assert response.status == 200
                        expect(page.locator('.art-card')).to_have_count(5)
                        expect(page.locator('html')).to_have_attribute('lang', 'zh-Hans' if locale=='zh' else locale)
                        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), locale
                    page.goto(BASE+'/en', wait_until='networkidle')
                    page.screenshot(path='/tmp/larkovart-desktop.png', full_page=True)
                    page.get_by_role('button', name='Drawings', exact=True).click()
                    expect(page.locator('.empty-state')).to_be_visible()
                    page.get_by_role('button', name='All works', exact=True).click()
                    expect(page.locator('.art-card')).to_have_count(5)
                    page.goto(BASE+'/en/art/atitlan', wait_until='networkidle')
                    page.get_by_role('button', name='See it in a room').click()
                    expect(page.locator('.room-scene')).to_be_visible()
                    expect(page.get_by_text('Digital room preview.', exact=False)).to_be_visible()
                    page.get_by_label('Language / Idioma').select_option('ja')
                    page.wait_for_url('**/ja/art/atitlan')
                    expect(page.locator('html')).to_have_attribute('lang','ja')
                    # Mobile navigation and the longest translations fit the viewport.
                    page.set_viewport_size({'width':390,'height':844})
                    for locale in ['es','en','ru','zh','ja','pt']:
                        page.goto(BASE+'/'+locale, wait_until='networkidle')
                        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), 'Mobile '+locale
                    page.goto(BASE+'/en', wait_until='networkidle')
                    page.screenshot(path='/tmp/larkovart-mobile.png', full_page=True)
                    page.get_by_role('button', name='Open menu').click()
                    expect(page.locator('.mobile-nav')).to_be_visible()
                    page.locator('.mobile-nav').get_by_text('The collection',exact=True).click()
                    expect(page.locator('.mobile-menu')).to_have_js_property('open',False)
                    # The studio cannot mutate data without authentication or origin.
                    rejected=page.request.post(BASE+'/api/studio/artworks',data={},headers={'Origin':BASE})
                    assert rejected.status == 403
                    denied=page.request.post(BASE+'/api/orders',data={},headers={'Origin':'https://example.invalid'})
                    assert denied.status == 403
                    page.goto(BASE+'/studio',wait_until='networkidle')
                    page.get_by_role('button', name='Send sign-in code').click()
                    expect(page.get_by_label('Email sign-in code')).to_be_visible()
                    page.get_by_label('Email sign-in code').fill(__import__('json').loads((Path(directory)/'email.json').read_text())['code'])
                    page.get_by_role('button',name='Verify code').click()
                    expect(page.get_by_role('heading',name='Your studio.')).to_be_visible()
                    # A test quote is recorded and leaves the original available.
                    page.goto(BASE+'/en/checkout/mar',wait_until='networkidle')
                    page.get_by_label('Full name').fill('Test Collector')
                    page.get_by_label('Email',exact=True).fill('collector@example.com')
                    page.get_by_label('Destination country').select_option('US')
                    page.get_by_label('Street address').fill('100 Example Street')
                    page.get_by_label('City',exact=True).fill('Example City')
                    page.get_by_label('Postal code').fill('10001')
                    page.get_by_role('button',name='Request a test quote').click()
                    expect(page.get_by_role('heading',name='Your test quote request is saved.')).to_be_visible()
                    page.goto(BASE+'/en/art/mar',wait_until='networkidle')
                    expect(page.get_by_role('link',name='Make it yours')).to_be_visible()
                    # A local simulation is persisted and cannot be purchased twice.
                    page.goto(BASE+'/en/checkout/gato',wait_until='networkidle')
                    page.get_by_label('Full name').fill('Test Collector')
                    page.get_by_label('Email',exact=True).fill('collector@example.com')
                    page.get_by_label('Street address').fill('100 Example Street')
                    page.get_by_label('City',exact=True).fill('Guatemala')
                    page.get_by_label('Postal code').fill('01012')
                    page.get_by_role('button',name='Simulate payment').click()
                    expect(page.get_by_role('heading',name='Your test order is ready.')).to_be_visible()
                    page.goto(BASE+'/en/art/gato',wait_until='networkidle')
                    expect(page.get_by_text('This original is no longer available.')).to_be_visible()
                    page.goto(BASE+'/studio',wait_until='networkidle')
                    page.get_by_role('button',name='Orders').click()
                    expect(page.locator('.studio-order')).to_have_count(2)
                    assert not errors, errors
                    browser.close()
                    print('PASS: six languages, desktop/mobile layout, filters, room view, navigation, authentication, CSRF, international quote and one-of-a-kind demo checkout.')
                    print('Screenshots: /tmp/larkovart-desktop.png and /tmp/larkovart-mobile.png')
            except Exception:
                log.flush(); log.seek(0)
                print(log.read()[-8000:])
                raise
            finally:
                try:
                    os.killpg(server.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                server.wait(timeout=20)

if __name__ == '__main__':
    run()
