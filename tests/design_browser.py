"""Original-photo and realistic-room regression checks, using an isolated database."""
import json, os, signal, subprocess, tempfile, time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:3220'
with tempfile.TemporaryDirectory(prefix='larkova-design-') as directory:
    env={**os.environ,'DATABASE_URL':f'file:{directory}/test.db','DATABASE_ENVIRONMENT':'development','RESEND_API_KEY':'re_test_local_only','LARKOVART_TEST_EMAIL_CAPTURE':str(Path(directory)/'email.json'),'NODE_OPTIONS':'--import='+str(ROOT/'tests/helpers/resend-fetch.mjs'),'CLOUDINARY_CLOUD_NAME':'','CLOUDINARY_API_KEY':'','CLOUDINARY_API_SECRET':''}
    with open(Path(directory)/'server.log','w+') as log:
        server=subprocess.Popen(['npm','run','start','--','--port','3220'],cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
        try:
            for _ in range(120):
                try:
                    if urlopen(BASE+'/en',timeout=3).status==200: break
                except Exception: time.sleep(.5)
            with sync_playwright() as p:
                browser=p.chromium.launch(headless=True,args=['--disable-gpu'])
                page=browser.new_page(viewport={'width':1440,'height':1050})
                errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(BASE+'/en',wait_until='networkidle')
                page.screenshot(path='/tmp/larkova-new-home.png',full_page=True)
                page.goto(BASE+'/en/art/atitlan',wait_until='networkidle')
                expect(page.locator('.original-photo')).to_be_visible()
                assert 'Atitlan.jpg' in page.locator('.original-photo>img').get_attribute('src')
                page.get_by_role('button',name='See it in a room',exact=True).click()
                for i in range(3):
                    page.locator('.scene-options button').nth(i).click()
                    expect(page.locator('.room-scene')).to_have_attribute('data-scene',['living','gallery','reading'][i])
                    page.wait_for_function("document.querySelector('.room-background')?.complete && document.querySelector('.room-background')?.naturalWidth>0")
                    assert 'Atitlan.jpg' in page.locator('.room-art img').get_attribute('src')
                    box=page.locator('.room-art').bounding_box()
                    assert abs(box['width']/box['height']-1)<.03
                    page.screenshot(path=f'/tmp/larkova-room-{i}.png',full_page=True)
                page.get_by_role('button',name='Artwork photograph',exact=True).click()
                expect(page.locator('.original-photo')).to_be_visible()
                page.goto(BASE+'/studio',wait_until='networkidle')
                page.screenshot(path='/tmp/larkova-new-login.png',full_page=True)
                assert page.locator('input[type=password]').count()==0
                page.get_by_role('button',name='Send sign-in code').click()
                expect(page.get_by_label('Email sign-in code')).to_be_visible()
                page.screenshot(path='/tmp/larkova-new-otp.png',full_page=True)
                email=json.loads((Path(directory)/'email.json').read_text())
                page.get_by_label('Email sign-in code').fill(email['code'])
                page.get_by_role('button',name='Verify code').click()
                expect(page.get_by_role('heading',name='Your studio.',exact=True)).to_be_visible()
                art={'id':'original-regression','title':'Original preference','category':'paintings','medium':'oil','width':30,'height':50,'year':2026,'price':10000,'status':'available','published':True,'image':'/artworks/Atitlan.jpg','originalImage':'/artworks/Gato.jpg','descriptions':{l:'Original artwork.' for l in ['es','en','ru','zh','ja','pt']}}
                assert page.request.post(BASE+'/api/studio/artworks',data=art,headers={'Origin':BASE}).status==200
                page.reload(wait_until='networkidle')
                expect(page.locator('.studio-work').last.locator('img')).to_have_attribute('src','/artworks/Gato.jpg')
                page.screenshot(path='/tmp/larkova-new-admin.png',full_page=True)
                page.get_by_role('button',name='Add artwork').click()
                expect(page.locator('.studio-draft')).to_be_visible()
                page.screenshot(path='/tmp/larkova-new-upload.png',full_page=True)
                page.goto(BASE+'/en/art/original-regression',wait_until='networkidle')
                assert 'Gato.jpg' in page.locator('.original-photo>img').get_attribute('src')
                page.locator('.scene-options button').first.click()
                box=page.locator('.room-art').bounding_box()
                assert abs(box['width']/box['height']-.6)<.03
                for locale in ['es','en','ru','zh','ja','pt']:
                    page.set_viewport_size({'width':390,'height':844})
                    page.goto(BASE+'/'+locale,wait_until='networkidle')
                    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),locale
                    expect(page.locator('.art-card')).to_have_count(6)
                page.screenshot(path='/tmp/larkova-new-mobile.png',full_page=True)
                page.goto(BASE+'/studio',wait_until='networkidle')
                page.get_by_role('button',name='Sign out').click()
                expect(page.get_by_role('button',name='Send sign-in code')).to_be_visible()
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
                page.screenshot(path='/tmp/larkova-new-login-mobile.png',full_page=True)
                assert not errors,errors
                browser.close()
                print('PASS: untouched originals in legacy listings, 3 loaded photographic environments, preserved art proportions, redesigned OTP/admin, 6 languages and mobile overflow checks.')
        finally:
            os.killpg(server.pid,signal.SIGTERM)
            server.wait(timeout=20)
