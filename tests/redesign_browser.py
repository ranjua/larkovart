"""Visual/interaction acceptance against isolated SQLite; no external provider writes."""
import json, os, signal, sqlite3, subprocess, tempfile, time, statistics
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]; BASE='http://127.0.0.1:3208'; OUT=Path('/tmp/larkova-redesign');OUT.mkdir(exist_ok=True)
LOCALES=['es','en','ru','zh','ja','pt']

def full_images(page):
    page.evaluate('window.scrollTo(0,document.body.scrollHeight)');page.wait_for_timeout(200)
    page.evaluate('window.scrollTo(0,document.querySelector("#artist")?.offsetTop||0)');page.wait_for_timeout(250)
    page.locator('#artist img').evaluate('(img)=>img.decode()')
    page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(500)

def fixture_change(db,changes):
    with sqlite3.connect(db,timeout=10) as c:
        for id,fields in changes.items():
            row=c.execute('SELECT data,status,published FROM artworks WHERE id=?',(id,)).fetchone();assert row
            data=json.loads(row[0]);data.update(fields)
            c.execute('UPDATE artworks SET data=?,status=?,published=? WHERE id=?',(json.dumps(data),fields.get('status',row[1]),int(fields.get('published',row[2])),id))

def run():
 with tempfile.TemporaryDirectory(prefix='larkova-redesign-browser-') as d:
  db=f'{d}/test.db';env={**os.environ,'DATABASE_URL':f'file:{db}','DATABASE_ENVIRONMENT':'development','RESEND_API_KEY':'re_test_local_only','LARKOVART_TEST_EMAIL_CAPTURE':f'{d}/email.json','NODE_OPTIONS':'--import='+str(ROOT/'tests/helpers/resend-fetch.mjs'),'CLOUDINARY_CLOUD_NAME':'','CLOUDINARY_API_KEY':'','CLOUDINARY_API_SECRET':''}
  with open(OUT/'browser-server.log','w+') as log:
   server=subprocess.Popen(['npm','run','start','--','--port','3208'],cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
   try:
    for _ in range(100):
     try:
      if urlopen(BASE+'/en',timeout=5).status==200:break
     except:time.sleep(.5)
    with sync_playwright() as p:
     browser=p.chromium.launch(headless=True,args=['--disable-gpu']);errors=[];failed_images=[]
     context=browser.new_context(viewport={'width':1440,'height':1000},record_video_dir=str(OUT/'recordings-desktop'),record_video_size={'width':1440,'height':1000})
     page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto(BASE+'/en',wait_until='networkidle')
     expect(page.locator('.hero-original img')).to_have_attribute('alt','Atitlan')
     assert not page.locator('.hero-visual .room-scene').count()
     assert not page.evaluate('performance.getEntriesByType("resource").some(r=>r.name.includes("%2Frooms%2F"))'),'Room scenes loaded before interaction'
     expect(page.locator('.available-collection .art-card')).to_have_count(3)
     expect(page.locator('.collection-archive .art-card')).to_have_count(2)
     expect(page.locator('.collection-archive .art-price')).to_have_count(0)
     page.locator('.hero-visual').hover(position={'x':80,'y':100});page.wait_for_timeout(200)
     assert page.locator('.hero-visual').evaluate('e=>e.style.getPropertyValue("--depth-x")')
     page.locator('.hero-original').hover();page.wait_for_timeout(250)
     page.locator('.art-image').first.scroll_into_view_if_needed();page.locator('.art-image').first.hover();page.wait_for_timeout(250)
     for name,count in [('Drawings',0),('Paintings',5),('Sculptures',0),('All works',5),('Drawings',0),('All works',5)]:
      page.get_by_role('button',name=name,exact=True).click();expect(page.locator('.art-card')).to_have_count(count)
     page.get_by_role('button',name='Drawings',exact=True).click();expect(page.locator('.empty-state a[href^="mailto:"]')).to_be_visible()
     page.get_by_role('button',name='All works',exact=True).click()
     full_images(page);page.screenshot(path=str(OUT/'after-home-1440.png'),full_page=True)
     page.locator('.hero-context>button').click();expect(page.locator('.hero-context .room-scene')).to_be_visible();expect(page.locator('.hero-context .fine-print')).to_contain_text('Digital room preview')
     page.locator('.hero-context>button').click()
     page.goto(BASE+'/en/art/atitlan',wait_until='networkidle');expect(page.locator('.scene-options')).to_have_count(0)
     expect(page.locator('.original-photo')).to_have_class(__import__('re').compile('is-visible'))
     page.locator('.photo-expand').focus();page.keyboard.press('Enter');expect(page.locator('dialog')).to_be_visible()
     expect(page.get_by_role('button',name='Close image',exact=True)).to_be_focused();page.keyboard.press('Tab')
     assert page.evaluate('document.querySelector("dialog").contains(document.activeElement)||document.activeElement===document.body'),'Dialog focus escaped'
     page.keyboard.press('Escape');expect(page.locator('dialog')).not_to_be_visible();expect(page.locator('.photo-expand')).to_be_focused()
     page.get_by_role('button',name='See it in a room',exact=True).click()
     for name,scene in [('Sunlit living','living'),('Quiet gallery','gallery'),('Warm reading room','reading')]:
      page.get_by_role('button',name=name,exact=True).click();expect(page.locator(f'.room-layer.is-visible .room-scene[data-scene={scene}]')).to_be_visible()
      img=page.locator(f'.room-scene[data-scene={scene}] .room-art');box=img.bounding_box();assert abs(box['width']/box['height']-1)<.02
     expect(page.locator('.scene-disclosure')).to_contain_text('Digital room preview')
     page.get_by_role('button',name='Artwork photograph',exact=True).click();expect(page.locator('.original-photo')).to_have_class(__import__('re').compile('is-visible'))
     page.screenshot(path=str(OUT/'after-detail-1440.png'),full_page=True)
     page.get_by_role('link',name='Make it yours',exact=True).click();expect(page.get_by_label('Full name')).to_be_visible();page.go_back(wait_until='networkidle');expect(page.locator('.original-photo')).to_be_visible()
     page.get_by_label('Language / Idioma').select_option('ja');page.wait_for_url('**/ja/art/atitlan');expect(page.locator('html')).to_have_attribute('lang','ja')
     context.close()
     print('PASS: original-led composition, real statuses/prices, rapid filters, dialog focus/Escape, all three room scenes, original/room transition, checkout/back and locale route preservation.',flush=True)
     print('Starting mobile motion/menu checks',flush=True)
     mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,record_video_dir=str(OUT/'recordings-mobile'),record_video_size={'width':390,'height':844})
     page=mobile.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE+'/en',wait_until='networkidle')
     page.get_by_role('button',name='Open menu',exact=True).click();expect(page.locator('.mobile-nav')).to_be_visible();page.wait_for_timeout(220)
     page.keyboard.press('Escape');expect(page.locator('.mobile-menu')).to_have_js_property('open',False);expect(page.get_by_role('button',name='Open menu',exact=True)).to_be_focused()
     page.get_by_role('button',name='Open menu',exact=True).click();page.locator('.mobile-nav').get_by_role('link',name='The artist',exact=True).click();expect(page.locator('.mobile-menu')).to_have_js_property('open',False)
     page.evaluate('scrollTo(0,0)');page.wait_for_timeout(300);full_images(page);page.screenshot(path=str(OUT/'after-home-390.png'),full_page=True)
     page.goto(BASE+'/en/art/atitlan',wait_until='networkidle');page.get_by_role('button',name='See it in a room',exact=True).click();page.get_by_role('button',name='Quiet gallery',exact=True).click();expect(page.locator('.room-layer.is-visible .room-scene[data-scene=gallery]')).to_be_visible();page.get_by_role('button',name='Artwork photograph',exact=True).click();page.screenshot(path=str(OUT/'after-detail-390.png'),full_page=True);mobile.close()
     print('PASS: mobile menu, touch room controls and recordings.',flush=True)
     # All six locales and representative responsive widths, with stable original photo geometry.
     c=browser.new_context();page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
     for width in [360,390,768,1024,1440]:
      page.set_viewport_size({'width':width,'height':1000})
      for locale in LOCALES:
       page.goto(BASE+'/'+locale,wait_until='networkidle');assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),(locale,width)
       expect(page.locator('html')).to_have_attribute('lang','zh-Hans' if locale=='zh' else locale)
       assert page.locator('.hero-original').bounding_box()['y']<750,(locale,width,'art too late')
       expect(page.locator('.filter-tabs button')).to_have_count(4)
       if width==390:
        page.screenshot(path=str(OUT/f'locale-{locale}-390.png'))
     page.set_viewport_size({'width':720,'height':500});page.goto(BASE+'/en',wait_until='networkidle');assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
     # CSS zoom 200% also checks that long translated text remains contained.
     page.evaluate('document.body.style.zoom="2"');assert not page.evaluate('document.documentElement.scrollWidth>innerWidth');page.evaluate('document.body.style.zoom=""')
     page.goto(BASE+'/en',wait_until='networkidle');page.keyboard.press('Tab');expect(page.locator('.skip-link')).to_be_focused();page.keyboard.press('Enter');expect(page.locator('main')).to_be_focused()
     c.close();print('PASS: 30 locale/width combinations, 200% zoom/reflow and keyboard skip link.',flush=True)
     # Reduced motion: no depth, entrance or rearrangement animations, same content and controls.
     c=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=c.new_page();page.goto(BASE+'/en',wait_until='networkidle')
     page.get_by_role('button',name='Drawings',exact=True).click();page.get_by_role('button',name='All works',exact=True).click();assert page.evaluate('document.getAnimations().filter(a=>a.playState==="running").length')==0
     expect(page.locator('.hero-original img')).to_be_visible();c.close()
     # No-script: real artwork/text/links and native mobile menu remain available.
     c=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});page=c.new_page();page.goto(BASE+'/en',wait_until='networkidle');expect(page.locator('.hero-original img')).to_be_visible();expect(page.locator('.art-card')).to_have_count(5);page.locator('summary').click();expect(page.locator('.mobile-nav')).to_be_visible();page.locator('.hero-original').click();expect(page.locator('.original-photo img')).to_be_visible();assert page.locator('.photo-expand').get_attribute('href').endswith('Atitlan.jpg');c.close()
     print('PASS: reduced motion and disabled JavaScript preserve visible originals, content, navigation and fallback photo link.',flush=True)
     # Read real authoritative state changes only in this isolated fixture DB.
     fixture_change(db,{'atitlan':{'status':'reserved'}})
     c=browser.new_context(viewport={'width':390,'height':844});page=c.new_page();page.goto(BASE+'/en',wait_until='networkidle');expect(page.locator('.hero-original img')).to_have_attribute('alt','Gato');page.goto(BASE+'/en/art/atitlan',wait_until='networkidle');expect(page.get_by_role('link',name='Make it yours')).to_have_count(0);expect(page.locator('.sold-note')).to_have_text('On hold')
     fixture_change(db,{'gato':{'status':'sold'},'mar':{'status':'sold'}});page.goto(BASE+'/en',wait_until='networkidle');expect(page.locator('.hero-original img')).to_have_attribute('alt','Atitlan');expect(page.locator('.hero-art-label')).to_contain_text('On hold');expect(page.locator('.hero-art-label')).not_to_contain_text('$')
     # Only one available sculpture: original photo, no wall mockup controls.
     fixture_change(db,{'gato':{'status':'available','category':'sculptures'}});page.goto(BASE+'/en',wait_until='networkidle');expect(page.locator('.hero-original img')).to_have_attribute('alt','Gato');expect(page.locator('.hero-context')).to_have_count(0);page.goto(BASE+'/en/art/gato',wait_until='networkidle');expect(page.get_by_role('button',name='See it in a room')).to_have_count(0)
     fixture_change(db,{id:{'published':False} for id in ['atitlan','gato','mar','peonea','quetzal']});page.goto(BASE+'/en',wait_until='networkidle');expect(page.locator('.hero-original')).to_have_count(0);expect(page.locator('.empty-state a[href^="mailto:"]')).to_be_visible();c.close()
     assert not errors,errors;browser.close()
     print('PASS: reserved/sold/no-available/sculpture/empty states use authoritative fixture data; no live data changed.')
   except Exception:
    log.flush();log.seek(0);print(log.read()[-6000:]);raise
   finally:
    server.terminate();server.wait(timeout=20)
if __name__=='__main__':run()
