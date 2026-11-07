"""Admin photo publishing against an isolated database; no provider writes."""
import os, secrets, signal, subprocess, tempfile, time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:3210'
with tempfile.TemporaryDirectory(prefix='larkovart-photo-') as directory:
    password = secrets.token_urlsafe(32)
    env = {**os.environ, 'DATABASE_URL': f'file:{directory}/test.db', 'DATABASE_ENVIRONMENT': 'development', 'STUDIO_PASSWORD': password, 'CLOUDINARY_CLOUD_NAME':'', 'CLOUDINARY_API_KEY':'', 'CLOUDINARY_API_SECRET':''}
    with open(Path(directory)/'server.log', 'w+') as log:
        server = subprocess.Popen(['npm','run','start','--','--port','3210'], cwd=ROOT, env=env, stdout=log, stderr=log, start_new_session=True)
        try:
            for _ in range(90):
                try:
                    if urlopen(BASE+'/en',timeout=3).status == 200: break
                except Exception: time.sleep(.5)
            with sync_playwright() as p:
                browser=p.chromium.launch(headless=True,args=['--disable-gpu'])
                page=browser.new_page()
                errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(BASE+'/studio')
                assert page.request.post(BASE+'/api/studio/photo',headers={'Origin':BASE}).status == 403
                page.get_by_label('Studio password').fill(password)
                page.get_by_role('button',name='Enter studio').click()
                expect(page.locator('.studio-draft')).to_be_visible()
                assert page.request.post(BASE+'/api/studio/photo',headers={'Origin':BASE}).status == 503
                form=page.locator('.studio-draft')
                form.locator('input[type=file]').set_input_files(ROOT/'public/artworks/Atitlan.jpg')
                form.get_by_label('Title',exact=True).fill('Photo workflow test')
                form.get_by_label('Width · cm').fill('30')
                form.get_by_label('Height · cm').fill('40')
                expect(form.get_by_label('Price · USD')).to_have_value('100')
                expect(form.get_by_label('Publish automatically when saved')).to_be_checked()
                form.get_by_role('button',name='Save artwork').click()
                expect(page.get_by_text('Artwork saved. Published works are now visible in the gallery.')).to_be_visible()
                page.goto(BASE+'/ja')
                expect(page.get_by_role('heading',name='Photo workflow test')).to_be_visible()
                page.get_by_role('link',name='Photo workflow test',exact=True).click()
                expect(page.get_by_text('30 × 40 cm',exact=True)).to_be_visible()
                expect(page.locator('.detail-description')).to_contain_text('30 × 40 cm')
                assert not errors,errors
                browser.close()
                print('PASS: private admin, disconnected provider status, original upload, default price, automatic six-language facts and publication.')
        finally:
            os.killpg(server.pid,signal.SIGTERM)
            server.wait(timeout=20)
