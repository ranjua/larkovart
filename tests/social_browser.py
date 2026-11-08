"""Social Studio browser journey; isolated databases, fake email, no provider traffic."""
import base64, json, os, signal, subprocess, tempfile, time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:3203'

def run():
    with tempfile.TemporaryDirectory(prefix='larkova-social-browser-') as directory:
        env = {**os.environ, 'DATABASE_URL': f'file:{directory}/commerce.db', 'DATABASE_ENVIRONMENT': 'development',
               'SOCIAL_DATABASE_URL': f'file:{directory}/social.db', 'SOCIAL_DATABASE_ENVIRONMENT': 'development',
               'SOCIAL_ENVIRONMENT': 'development', 'SOCIAL_WORKER_MODE': 'manual', 'SOCIAL_PUBLISH_ENABLED': 'false',
               'SOCIAL_TEST_WRITES_ENABLED':'false', 'SOCIAL_ORIGIN':'https://studio.example.test',
               'SOCIAL_INSTAGRAM_CLIENT_ID':'fixture-app', 'SOCIAL_INSTAGRAM_CLIENT_SECRET':'fixture-app-secret',
               'SOCIAL_TOKEN_KEY_V1':base64.b64encode(bytes(range(32))).decode(), 'LARKOVART_SOCIAL_PROVIDER_FIXTURE':'true', 'RESEND_API_KEY':'re_test_local_only',
               'LARKOVART_TEST_EMAIL_CAPTURE':str(Path(directory)/'email.json'),
               'NODE_OPTIONS':'--import='+str(ROOT/'tests/helpers/social-fetch.mjs')}
        with open(Path(directory)/'server.log','w+') as log:
            server = subprocess.Popen(['npm','run','start','--','--port','3203'],cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
            try:
                for _ in range(120):
                    if server.poll() is not None: raise RuntimeError('Test server exited')
                    try:
                        if urlopen(BASE+'/en',timeout=5).status == 200: break
                    except Exception: time.sleep(.5)
                else: raise RuntimeError('Test server did not start')
                with sync_playwright() as p:
                    browser=p.chromium.launch(headless=True,args=['--disable-gpu'])
                    context=browser.new_context(viewport={'width':1440,'height':1050})
                    page=context.new_page(); errors=[]
                    page.on('pageerror',lambda e:errors.append(str(e)))
                    assert page.request.get(BASE+'/api/studio/social/status').status == 403
                    page.goto(BASE+'/studio/social',wait_until='networkidle')
                    expect(page.get_by_role('button',name='Send sign-in code')).to_be_visible()
                    page.get_by_role('button',name='Send sign-in code').click()
                    expect(page.get_by_label('Email sign-in code')).to_be_visible()
                    page.get_by_label('Email sign-in code').fill(json.loads((Path(directory)/'email.json').read_text())['code'])
                    page.get_by_role('button',name='Verify code').click()
                    expect(page.get_by_role('heading',name='Your studio.')).to_be_visible()
                    assert page.request.post(BASE+'/api/studio/social/settings',data={'paused':True},headers={'Origin':'https://evil.invalid'}).status == 403
                    assert page.request.post(BASE+'/api/studio/social/posts',data='x'*65537,headers={'Origin':BASE,'Content-Type':'application/json'}).status == 413
                    page.goto(BASE+'/studio/social',wait_until='networkidle')
                    expect(page.get_by_role('heading',name='Art worth sharing.')).to_be_visible()
                    page.get_by_role('button',name='New campaign',exact=True).click()
                    page.get_by_label('Campaign title').fill('Browser original campaign')
                    page.get_by_role('button',name='Save campaign drafts').click()
                    expect(page.locator('.social-target')).to_have_count(4)
                    state=page.request.get(BASE+'/api/studio/social/status').json()
                    assert len(state['posts'])==1 and len(state['targets'])==4
                    assert state['config']['publishEnabled'] is False
                    first=page.locator('.social-target').first
                    first.get_by_label('Caption',exact=False).fill('Original artwork. Consultas por mensaje. Original art — inquiries welcome.')
                    first.get_by_role('button',name='Save version changes').click()
                    expect(page.locator('.social-feedback[role=alert]')).to_contain_text('Version saved')
                    first=page.locator('.social-target').first
                    first.get_by_role('button',name='Validate',exact=True).click()
                    expect(page.locator('.social-feedback[role=alert]')).to_contain_text('passes local validation')
                    first.get_by_role('button',name='Approve exact version').click()
                    expect(first.locator('.social-badge')).to_have_text('Approved')
                    t=page.request.get(BASE+'/api/studio/social/status').json()['targets'][0]
                    response=page.request.get(BASE+f"/api/studio/social/targets/{t['id']}/export")
                    assert response.status==200
                    pack=response.json(); assert pack['platform']==t['provider']
                    # Download the actual source, not a fabricated ZIP or public preview link.
                    asset_id=t['assetIds'][0]
                    source=page.request.get(BASE+f'/api/studio/social/assets/{asset_id}/download')
                    assert source.status==200 and len(source.body())>100
                    # Any edit clears approval; no stale version can be queued.
                    first.get_by_label('Caption',exact=False).fill('Updated exact original artwork caption. Consultas por mensaje.')
                    first.get_by_role('button',name='Save version changes').click()
                    expect(first.locator('.social-badge')).to_have_text('Draft')
                    first.get_by_role('button',name='Approve exact version').click()
                    expect(first.locator('.social-badge')).to_have_text('Approved')
                    first.get_by_role('button',name='Prepare manual package').click()
                    expect(first.locator('.social-badge')).to_have_text('Queued')
                    page.get_by_role('button',name='Run due jobs').click()
                    expect(first.locator('.social-badge')).to_have_text('Ready for manual posting')
                    first.get_by_role('button',name='Record native post').click()
                    first.get_by_role('button',name='Confirm I posted this natively').click()
                    expect(first.locator('.social-badge')).to_have_text('Posted manually · unverified')
                    # Scheduling is persisted and clear about the manual worker.
                    second=page.locator('.social-target').nth(1)
                    second.get_by_label('Planned local time').fill('2027-01-10T10:00')
                    second.get_by_role('button',name='Save version changes').click()
                    expect(page.locator('.social-feedback[role=alert]')).to_contain_text('Version saved')
                    second.get_by_role('button',name='Approve exact version').click()
                    expect(second.locator('.social-badge')).to_have_text('Approved')
                    second.get_by_role('button',name='Queue approved schedule').click()
                    expect(second.locator('.social-badge')).to_have_text('Scheduled')
                    page.get_by_role('button',name='Calendar',exact=True).click()
                    expect(page.locator('.social-calendar-row')).to_have_count(1)
                    expect(page.get_by_text('America/Guatemala',exact=True)).to_be_visible()
                    page.get_by_label('Week starting · Guatemala time').fill('2027-01-10')
                    page.get_by_label('Show this seven-day window').check()
                    expect(page.locator('.social-calendar-row')).to_have_count(1)
                    page.get_by_label('Week starting · Guatemala time').fill('2027-01-20')
                    expect(page.locator('.social-calendar-row')).to_have_count(0)
                    page.reload(wait_until='networkidle')
                    page.get_by_role('button',name='Content',exact=True).click()
                    expect(page.locator('.social-target')).to_have_count(4)
                    expect(page.locator('.social-target').first.locator('.social-badge')).to_have_text('Posted manually · unverified')
                    page.screenshot(path='/tmp/larkova-social-desktop.png',full_page=True)
                    page.set_viewport_size({'width':390,'height':844})
                    for tab in ['Overview','Content','Calendar','Media','Connections','Analytics','Activity']:
                        page.get_by_role('button',name=tab,exact=True).click()
                        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),tab
                    page.get_by_role('button',name='Connections',exact=True).click()
                    expect(page.get_by_role('button',name='Connect TikTok',exact=False)).to_be_disabled()
                    expect(page.get_by_role('button',name='Connect Facebook Pages',exact=False)).to_be_disabled()
                    page.screenshot(path='/tmp/larkova-social-mobile.png',full_page=True)
                    # No callback can exchange a code without the dedicated browser binding/state.
                    callback=page.request.get(BASE+'/api/social/oauth/instagram/callback?code=not-real&state=not-real')
                    assert callback.status==200 and 'needs attention' in callback.text()
                    # A valid OAuth callback does not need the Strict Studio cookie.
                    start=page.request.post(BASE+'/api/studio/social/connections/instagram/start',data={},headers={'Origin':BASE})
                    assert start.status==200
                    from urllib.parse import urlparse,parse_qs
                    state_value=parse_qs(urlparse(start.json()['url']).query)['state'][0]
                    oauth_cookie=[c for c in context.cookies() if c['name']=='larkova_social_oauth_instagram']
                    assert len(oauth_cookie)==1 and oauth_cookie[0]['sameSite']=='Lax'
                    cross_site=browser.new_context()
                    cross_site.add_cookies(oauth_cookie)
                    callback=cross_site.request.get(BASE+'/api/social/oauth/instagram/callback?code=fixture-code&state='+state_value)
                    assert callback.status==200 and 'Confirm your account' in callback.text()
                    replay=cross_site.request.get(BASE+'/api/social/oauth/instagram/callback?code=fixture-code&state='+state_value)
                    assert 'needs attention' in replay.text()
                    connected=page.request.get(BASE+'/api/studio/social/status').json()['connections']
                    assert len(connected)==1 and connected[0]['username']=='larkova.art'
                    assert connected[0]['metadata']['selected'] is False
                    assert 'fixture-long-token' not in json.dumps(connected)
                    assert 'authSubjectId' not in connected[0]['metadata']
                    cross_site.close()
                    assert not errors,errors
                    browser.close()
                    print('PASS: OTP, private API/CSRF/body limits, four persistent variants, edits invalidate approval, actual package/media download, manual outcome, scheduling, seven mobile tabs and callback rejection. No social provider traffic.')
            except Exception:
                log.flush();log.seek(0);print(log.read()[-6000:]);raise
            finally:
                os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=20)
if __name__=='__main__':run()
