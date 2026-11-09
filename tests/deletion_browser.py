"""Admin-only permanent deletion with real route/DB checks; isolated fixtures and fake mail."""
import os,subprocess,tempfile,time,json,sqlite3
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];BASE='http://127.0.0.1:3219'
with tempfile.TemporaryDirectory(prefix='larkova-delete-browser-') as d:
 env={**os.environ,'DATABASE_URL':f'file:{d}/store.db','DATABASE_ENVIRONMENT':'development','RESEND_API_KEY':'re_test_local_only','LARKOVART_TEST_EMAIL_CAPTURE':d+'/email.json','NODE_OPTIONS':'--import='+str(ROOT/'tests/helpers/customer-fetch.mjs'),'PAYMENT_PROVIDER':'demo','CUSTOMER_AUTH_SECRET':'','CUSTOMER_AUTH_ORIGIN':''}
 with open(Path(d)/'server.log','w+') as log:
  server=subprocess.Popen(['node',str(ROOT/'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3219'],cwd=ROOT,env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:
     if urlopen(BASE+'/en',timeout=3).status==200:break
    except:time.sleep(.3)
   with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--disable-gpu']);context=browser.new_context();page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def delete(id,title,ctx=context,origin=BASE):return ctx.request.delete(BASE+'/api/studio/artworks/'+id,data={'confirmTitle':title},headers={'Origin':origin})
    assert delete('gato','Gato').status==403
    order=context.request.post(BASE+'/api/orders',data={'artworkId':'mar','name':'Fixture Buyer','email':'fixture@example.test','country':'US','city':'Test City','address':'Fixture street 123','postal':'10001'},headers={'Origin':BASE})
    assert order.status==201
    with sqlite3.connect(Path(d)/'store.db') as db:
     original=db.execute("SELECT data FROM artworks WHERE id='atitlan'").fetchone()[0]
     art=json.loads(original);art['id']='duplicate-fixture';art['title']='Atitlan duplicate'
     db.execute('INSERT INTO artworks VALUES (?,?,?,?)',(art['id'],json.dumps(art),'available',1))
    assert context.request.post(BASE+'/api/studio/session',data={'action':'request'},headers={'Origin':BASE}).status==200
    code=json.loads(Path(d+'/email.json').read_text())['code']
    assert context.request.post(BASE+'/api/studio/session',data={'action':'verify','code':code},headers={'Origin':BASE}).status==200
    page.goto(BASE+'/studio',wait_until='networkidle')
    target=page.locator('.studio-work').filter(has=page.get_by_role('heading',name='Atitlan duplicate',exact=True))
    expect(target.get_by_role('button',name='Delete artwork',exact=True)).to_be_enabled()
    protected=page.locator('.studio-work').filter(has=page.get_by_role('heading',name='Mar2',exact=True))
    expect(protected.get_by_role('button',name='Delete artwork',exact=True)).to_be_disabled()
    assert delete('mar','Mar2').status==409
    assert delete('duplicate-fixture','Atitlan duplicate',origin='https://attacker.example').status==403
    assert delete('duplicate-fixture','wrong title').status==409
    page.once('dialog',lambda dialog:dialog.dismiss());target.get_by_role('button',name='Delete artwork',exact=True).click()
    expect(target).to_have_count(1)
    page.once('dialog',lambda dialog:dialog.accept())
    with page.expect_response(lambda r:'/api/studio/artworks/duplicate-fixture' in r.url and r.request.method=='DELETE') as deleted:
     target.get_by_role('button',name='Delete artwork',exact=True).click()
    assert deleted.value.status==200
    expect(target).to_have_count(0);expect(page.get_by_role('status')).to_contain_text('permanently deleted')
    assert delete('duplicate-fixture','Atitlan duplicate').status==200
    assert page.request.get(BASE+'/en/art/duplicate-fixture').status==404
    stale=context.request.post(BASE+'/api/studio/artworks',data=art,headers={'Origin':BASE});assert stale.status==410
    with sqlite3.connect(Path(d)/'store.db') as db:
     assert db.execute("SELECT count(*) FROM artworks WHERE id='duplicate-fixture'").fetchone()[0]==0
     assert db.execute('SELECT count(*) FROM orders').fetchone()[0]==1
     assert db.execute("SELECT data FROM artworks WHERE id='atitlan'").fetchone()[0]==original
    # A seed can also be deleted, and must remain absent on the next cold start.
    seed=page.locator('.studio-work').filter(has=page.get_by_role('heading',name='Gato',exact=True))
    page.once('dialog',lambda dialog:dialog.accept());seed.get_by_role('button',name='Delete artwork',exact=True).click();expect(seed).to_have_count(0)
    page.set_viewport_size({'width':390,'height':844});assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    assert not errors,errors
    browser.close();print('PASS: admin OTP, delete confirmation/cancel, order guard, CSRF, stale-title protection, hard removal, safe retries, stale-save rejection and mobile Studio.')
  except Exception:
   log.seek(0);print(log.read()[-3000:]);raise
  finally:server.terminate();server.wait(timeout=20)
