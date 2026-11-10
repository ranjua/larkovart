"""Customer and real-photo-set flows; isolated SQLite and email transport, no provider writes."""
import os, signal, subprocess, tempfile, time, json, base64, uuid
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:3214'
OUT=Path('/tmp/larkova-customers');OUT.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='larkova-customer-browser-') as directory:
 capture=Path(directory)/'email.json'
 env={**os.environ,'DATABASE_URL':f'file:{directory}/commerce.db','DATABASE_ENVIRONMENT':'development','CUSTOMER_DATABASE_URL':f'file:{directory}/customers.db','CUSTOMER_DATABASE_ENVIRONMENT':'development','CUSTOMER_ENVIRONMENT':'development','CUSTOMER_AUTH_SECRET':'isolated-browser-customer-secret-1234567890','CUSTOMER_AUTH_ORIGIN':BASE,'CUSTOMER_EMAIL_FROM':'Larkova Test <accounts@example.test>','RESEND_API_KEY':'re_test_local_only','LARKOVART_TEST_EMAIL_CAPTURE':str(capture),'NODE_OPTIONS':'--import='+str(ROOT/'tests/helpers/customer-fetch.mjs'),'CUSTOMER_GOOGLE_CLIENT_ID':'','CUSTOMER_GOOGLE_CLIENT_SECRET':'','CLOUDINARY_CLOUD_NAME':'','CLOUDINARY_API_KEY':'','CLOUDINARY_API_SECRET':''}
 with open(Path(directory)/'server.log','w+') as log:
  server=subprocess.Popen(['npm','run','start','--','--port','3214'],cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
  try:
   for _ in range(120):
    try:
     if urlopen(BASE+'/en',timeout=3).status==200:break
    except Exception:time.sleep(.5)
   with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--disable-gpu'])
    context=browser.new_context(); page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def post(path,data,ctx=context,origin=BASE):return ctx.request.post(BASE+path,data=data,headers={'Origin':origin})
    def code():
     for _ in range(100):
      if capture.exists():return json.loads(capture.read_text())['code']
      time.sleep(.1)
     raise AssertionError('No fixture email received')
    rejected=context.request.get(BASE+'/api/auth/callback/google?error=access_denied',max_redirects=0)
    assert rejected.status==302 and rejected.text()==''
    assert rejected.headers.get('cache-control')=='no-store'
    page.goto(BASE+'/en/art/mar')
    page.get_by_role('button',name='Save to favorites',exact=True).first.click()
    page.get_by_role('button',name='Add to cart',exact=True).first.click()
    page.goto(BASE+'/en/favorites');expect(page.locator('.saved-list article')).to_have_count(1)
    page.goto(BASE+'/en/account')
    expect(page.get_by_role('button',name='Continue with Google')).to_be_disabled()
    page.get_by_role('button',name='Create account',exact=True).first.click()
    page.get_by_label('Your name',exact=True).fill('Collector One')
    page.get_by_label('Email',exact=True).fill('collector-one@example.test')
    page.get_by_label('Password',exact=True).fill('Browser-test-password-123!')
    page.locator('form').get_by_role('button',name='Create account',exact=True).click()
    expect(page.get_by_label('Email code',exact=True)).to_be_visible()
    page.get_by_label('Email code',exact=True).fill(code())
    page.locator('form').get_by_role('button',name='Verify code',exact=True).click()
    expect(page.get_by_label('Password',exact=True)).to_be_visible()
    page.get_by_label('Password',exact=True).fill('Browser-test-password-123!')
    page.locator('form').get_by_role('button',name='Sign in',exact=True).click()
    expect(page.get_by_role('heading',name='Collector One',exact=True)).to_be_visible()
    page.screenshot(path=str(OUT/'account-desktop.png'),full_page=True)
    state=context.request.get(BASE+'/api/customer/state').json()
    assert state['saved']=={'favorites':['mar'],'cart':['mar']}
    assert 'token' not in context.request.get(BASE+'/api/auth/get-session').json()['session']
    assert post('/api/studio/photo',{}).status==403
    assert post('/api/customer/saved',{'kind':'cart','artworkId':'peonea','present':True}).status==409
    assert post('/api/customer/saved',{'kind':'favorite','artworkId':'mar','present':False},origin='https://attacker.example').status==403
    assert post('/api/auth/sign-in/email-otp',{'email':'collector-one@example.test','otp':code()}).status==404
    page.get_by_label('Confirm your current password',exact=True).fill('Browser-test-password-123!')
    page.get_by_role('button',name='Enable email code',exact=True).click()
    expect(page.get_by_role('button',name='Disable email code',exact=True)).to_be_visible()
    page.get_by_role('button',name='Sign out',exact=True).click()
    expect(page.get_by_label('Password',exact=True)).to_be_visible()
    page.get_by_label('Email',exact=True).fill('collector-one@example.test')
    page.get_by_label('Password',exact=True).fill('Browser-test-password-123!')
    page.locator('form').get_by_role('button',name='Sign in',exact=True).click()
    expect(page.get_by_label('Email code',exact=True)).to_be_visible()
    expect(page.locator('.customer-feedback')).to_contain_text('Your password was accepted.')
    assert context.request.get(BASE+'/api/customer/state').json()['user'] is None
    assert post('/api/customer/saved',{'kind':'favorite','artworkId':'gato','present':True}).status==401
    page.get_by_label('Email code',exact=True).fill(code())
    page.locator('form').get_by_role('button',name='Verify code',exact=True).click()
    expect(page.get_by_role('heading',name='Collector One',exact=True)).to_be_visible()
    page.goto(BASE+'/en/cart');expect(page.locator('.saved-list article')).to_have_count(1)
    expect(page.get_by_text('Each original has its own payment and destination confirmation.',exact=False)).to_be_visible()
    second=browser.new_context()
    assert post('/api/auth/sign-up/email',{'email':'collector-two@example.test','password':'Second-browser-password-123!','name':'Collector Two'},second).status==200
    assert post('/api/auth/email-otp/verify-email',{'email':'collector-two@example.test','otp':code()},second).status==200
    assert post('/api/auth/sign-in/email',{'email':'collector-two@example.test','password':'Second-browser-password-123!'},second).status==200
    assert second.request.get(BASE+'/api/customer/state').json()['saved']=={'favorites':[],'cart':[]}
    # Private studio is a separate OTP account, never a customer role.
    admin=browser.new_context()
    assert post('/api/studio/session',{'action':'request'},admin).status==200
    assert post('/api/studio/session',{'action':'verify','code':code()},admin).status==200
    tiny='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII='
    photo={'id':str(uuid.uuid4()),'image':tiny,'kind':'signature'}
    endpoint='/api/studio/artworks/mar/photos'
    assert post(endpoint,{'expectedRevision':0,'photos':[photo]},admin).status==200
    assert post(endpoint,{'expectedRevision':0,'photos':[]},admin).status==409
    assert post(endpoint,{'expectedRevision':1,'photos':[{'id':str(uuid.uuid4()),'image':'https://example.com/forged.jpg','kind':'detail'}]},admin).status==422
    adminpage=admin.new_page();adminpage.goto(BASE+'/studio')
    assert post('/api/studio/email-test',{},second).status==403
    assert post('/api/studio/email-test',{},admin).status==503
    expect(adminpage.get_by_text('Gmail setup pending',exact=True)).to_be_visible()
    adminpage.get_by_text('Customer emails',exact=True).click()
    expect(adminpage.get_by_role('button',name='Send test to my Gmail',exact=True)).to_be_disabled()
    editor=adminpage.locator('.studio-work').filter(has=adminpage.get_by_role('heading',name='Mar2',exact=True)).locator('.photo-set-editor')
    editor.locator('summary').click()
    editor.get_by_label('Add photograph',exact=True).set_input_files(ROOT/'public/artworks/Peonea.jpg')
    expect(editor.get_by_text('Original photo added.',exact=False)).to_be_visible()
    editor.locator('select').last.select_option('backPhoto')
    editor.get_by_role('button',name='Move earlier',exact=True).last.click()
    with adminpage.expect_response(lambda r:'/api/studio/artworks/mar/photos' in r.url) as saved:
     editor.get_by_role('button',name='Save photo set',exact=True).click()
    assert saved.value.status==200
    page.goto(BASE+'/en/art/mar');expect(page.locator('.art-photo-options button')).to_have_count(3)
    page.get_by_role('button',name='Signature',exact=True).click()
    expect(page.locator('.original-photo img')).to_have_attribute('src',tiny)
    page.get_by_role('button',name='Original photograph',exact=True).click()
    expect(page.locator('.original-photo img')).not_to_have_attribute('src',tiny)
    import sqlite3
    with sqlite3.connect(str(Path(directory)/'commerce.db')) as db:
     db.execute("UPDATE artworks SET data=json_set(data,'$.price',12300) WHERE id='mar'")
    page.goto(BASE+'/en/cart');expect(page.locator('.saved-list')).to_contain_text('$123')
    page.set_viewport_size({'width':390,'height':900});page.screenshot(path=str(OUT/'cart-mobile.png'),full_page=True)
    with sqlite3.connect(str(Path(directory)/'commerce.db')) as db:
     db.execute("UPDATE artworks SET status='sold' WHERE id='mar'")
    page.goto(BASE+'/en/cart');expect(page.get_by_role('link',name='Continue to checkout',exact=True)).to_have_count(0)
    expect(page.locator('.saved-list')).to_contain_text('unavailable')
    for locale in ['en','es','ru','zh','ja','pt']:
     page.goto(BASE+'/'+locale+'/policies');expect(page.locator('#privacy')).to_be_visible()
     for width in [390,768,1440]:
      page.set_viewport_size({'width':width,'height':900})
      assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(locale,width)
    page.goto(BASE+'/en/account');page.get_by_role('button',name='Sign out',exact=True).click()
    expect(page.get_by_label('Password',exact=True)).to_be_visible()
    assert context.request.get(BASE+'/api/customer/state').json()['saved'] is None
    assert not errors,errors
    browser.close()
    print('PASS: verified signup, guest merge, private favorites/cart, optional OTP, token redaction, CSRF, studio isolation, signed-photo validation, photo revision conflicts and six-language policies.')
  except Exception:
   import sqlite3
   with sqlite3.connect(str(Path(directory)/'customers.db')) as db:
    print('Fixture DB counts:',[(t[0],db.execute('select count(*) from '+t[0]).fetchone()[0]) for t in db.execute("select name from sqlite_master where type='table'").fetchall()])
   log.seek(0); print(log.read()[-4000:]); raise
  finally:
   os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=20)
