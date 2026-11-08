"""Sandbox UI and missing-credential checks. Makes no external provider calls."""
import os
import signal
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:3300'

def run():
    with tempfile.TemporaryDirectory(prefix='larkovart-dev-sandbox-browser-') as directory:
        env = {**os.environ, 'DATABASE_URL': f'file:{directory}/test.db',
               'DATABASE_ENVIRONMENT': 'development', 'RESEND_API_KEY': 're_test_local_only', 'LARKOVART_TEST_EMAIL_CAPTURE': str(Path(directory)/'email.json'), 'NODE_OPTIONS': '--import='+str(ROOT/'tests/helpers/resend-fetch.mjs'),
               'PAYMENT_PROVIDER':'recurrente', 'PAYMENT_ENVIRONMENT':'sandbox',
               'RECURRENTE_SECRET_KEY':'', 'RECURRENTE_SANDBOX_ID':'',
               'RECURRENTE_WEBHOOK_SECRET':'', 'DHL_TEST_USERNAME':'',
               'DHL_TEST_PASSWORD':'', 'DHL_TEST_ACCOUNT':'', 'DHL_TEST_SHIPPER_JSON':'',
               'SHIPPING_AUTO_BOOK_TEST':'false','SHIPPING_TEST_SHIPPER_JSON':'',
               'FORZA_TEST_CODAPP':'','FEDEX_TEST_CLIENT_ID':'','CRON_SECRET':'',
               'OPENAI_API_KEY':'','OPENAI_TEXT_MODEL':''}
        with open(Path(directory)/'server.log','w+') as log:
            server = subprocess.Popen(['npm','run','start','--','--port','3300'],cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
            try:
                for _ in range(80):
                    try:
                        if urlopen(BASE+'/en',timeout=5).status == 200: break
                    except Exception: time.sleep(.3)
                else: raise RuntimeError('Sandbox test server did not become ready.')
                with sync_playwright() as p:
                    browser=p.chromium.launch(headless=True,args=['--disable-gpu'])
                    page=browser.new_page(viewport={'width':1280,'height':900})
                    errors=[]
                    page.on('pageerror',lambda e:errors.append(str(e)))
                    page.goto(BASE+'/studio',wait_until='networkidle')
                    page.get_by_role('button', name='Send sign-in code').click()
                    expect(page.get_by_label('Email sign-in code')).to_be_visible()
                    page.get_by_label('Email sign-in code').fill(__import__('json').loads((Path(directory)/'email.json').read_text())['code'])
                    page.get_by_role('button',name='Verify code').click()
                    expect(page.get_by_role('heading',name='Your studio.')).to_be_visible()
                    page.locator('.studio-settings > summary').click()
                    expect(page.get_by_text('Forza · Guatemala:', exact=False)).to_be_visible()
                    expect(page.get_by_text('FedEx · international:', exact=False)).to_be_visible()
                    expect(page.get_by_text('Guatex · awaiting API documentation:', exact=False)).to_be_visible()
                    expect(page.get_by_role('button',name='Copy courier access request')).to_be_visible()
                    work=page.locator('.studio-work').first
                    work.locator('summary').click()
                    for name,value in {'parcelLength':'60','parcelWidth':'60','parcelHeight':'10','parcelWeight':'3','netWeight':'2','originCountry':'GT','hsCode':'970191','shippingBudget':'100'}.items():
                        work.locator(f'[name="{name}"]').fill(value)
                    work.get_by_role('button',name='Save changes').click()
                    expect(page.get_by_text('Artwork saved. Published works are now visible in the gallery.')).to_be_visible()
                    page.goto(BASE+'/en/checkout/atitlan',wait_until='networkidle')
                    def fill():
                        page.get_by_label('Full name').fill('Test Collector')
                        page.get_by_label('Email',exact=True).fill('collector@example.com')
                        page.get_by_label('Phone number').fill('+15005550006')
                        page.get_by_label('Street address').fill('100 Fictional Street')
                        page.get_by_label('City',exact=True).fill('Guatemala')
                        page.get_by_label('Postal code').fill('01012')
                    fill()
                    page.get_by_role('button',name='Continue to test payment').click()
                    expect(page.locator('.form-error')).to_contain_text('Something went wrong')
                    page.goto(BASE+'/en/art/atitlan',wait_until='networkidle')
                    expect(page.get_by_role('link',name='Make it yours')).to_be_visible()
                    # An unpacked original requests a quote, never an invented rate.
                    page.goto(BASE+'/en/checkout/gato',wait_until='networkidle')
                    fill()
                    page.get_by_role('button',name='Request a test quote').click()
                    expect(page.get_by_role('heading',name='Your test quote request is saved.')).to_be_visible()
                    page.goto(BASE+'/en/art/gato',wait_until='networkidle')
                    expect(page.get_by_role('link',name='Make it yours')).to_be_visible()
                    assert page.request.post(BASE+'/api/orders',data={},headers={'Origin':BASE}).status == 403
                    assert page.request.post(BASE+'/api/webhooks/recurrente',data={}).status == 503
                    assert page.request.get(BASE+'/api/cron/reconcile').status == 401
                    assert not errors, errors
                    browser.close()
                    print('PASS: sandbox checkout UI, packing edits, quote fallback, unavailable-account handling, no demo-payment bypass, webhook and cron guards.')
            except Exception:
                log.flush();log.seek(0);print(log.read()[-5000:]);raise
            finally:
                try: os.killpg(server.pid,signal.SIGTERM)
                except ProcessLookupError: pass
                server.wait(timeout=20)

if __name__ == '__main__': run()
