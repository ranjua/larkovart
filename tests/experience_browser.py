"""Immersive art experience: real photographs, accessible gallery, touch and zoom; isolated data."""
import os,subprocess,tempfile,time,json
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]; BASE='http://127.0.0.1:3216'; OUT=Path('/tmp/larkova-experience');OUT.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='larkova-experience-') as directory:
 env={**os.environ,'DATABASE_URL':f'file:{directory}/commerce.db','DATABASE_ENVIRONMENT':'development','CUSTOMER_AUTH_SECRET':'','CUSTOMER_AUTH_ORIGIN':'','CUSTOMER_GOOGLE_CLIENT_ID':'','CUSTOMER_GOOGLE_CLIENT_SECRET':''}
 with open(OUT/'browser-server.log','w+') as log:
  server=subprocess.Popen(['node',str(ROOT/'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3216'],cwd=ROOT,env=env,stdout=log,stderr=log)
  try:
   for _ in range(120):
    try:
     if urlopen(BASE+'/en',timeout=3).status==200:break
    except:time.sleep(.5)
   with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--disable-gpu']); errors=[]
    context=browser.new_context(viewport={'width':1440,'height':1000},record_video_dir=str(OUT/'desktop-recording'),record_video_size={'width':1440,'height':1000});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'/en',wait_until='networkidle')
    expect(page.locator('.hero-original img')).to_have_attribute('alt','Atitlan')
    assert page.locator('.hero-original').bounding_box()['y']<500
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    page.wait_for_timeout(700)
    page.screenshot(path=str(OUT/'desktop-opening.png'))
    page.locator('.hero-selector').get_by_role('button',name='Selected original: Gato',exact=True).click()
    expect(page.locator('.hero-original')).to_have_attribute('href','/en/art/gato')
    expect(page.locator('.inspection-image')).to_have_attribute('alt','Gato')
    enter=page.get_by_role('button',name='Enter the gallery',exact=True);enter.click()
    dialog=page.get_by_role('dialog',name='A moment with the art')
    expect(dialog).to_be_visible();expect(dialog.get_by_role('heading',name='Gato',exact=True)).to_be_visible()
    assert page.evaluate('document.body.style.overflow')=='hidden'
    page.keyboard.press('ArrowRight');expect(dialog.get_by_role('heading',name='Mar2',exact=True)).to_be_visible()
    page.keyboard.press('ArrowRight');expect(dialog.get_by_role('heading',name='Peonea',exact=True)).to_be_visible()
    expect(dialog.locator('.exhibition-caption')).to_contain_text('In a private collection')
    assert '$' not in dialog.locator('.exhibition-caption').inner_text()
    for _ in range(12):
     page.keyboard.press('Tab');assert page.evaluate('document.querySelector("dialog").contains(document.activeElement)')
    dialog.locator('.exhibition-original').evaluate('(img)=>img.decode()')
    page.wait_for_timeout(650)
    assert dialog.locator('.exhibition-original').bounding_box()['width']>100
    page.screenshot(path=str(OUT/'desktop-gallery.png'))
    page.keyboard.press('Escape');expect(dialog).to_have_count(0);expect(enter).to_be_focused()
    assert page.evaluate('document.body.style.overflow')==''
    page.locator('.card-gallery-launch').first.click();dialog=page.get_by_role('dialog')
    expect(dialog.get_by_role('heading',name='Atitlan',exact=True)).to_be_visible()
    dialog.get_by_role('button',name='Leave the gallery').click()
    expect(page.locator('.card-gallery-launch').first).to_be_focused()
    slider=page.get_by_role('slider',name='Photograph magnification');slider.focus();slider.press('End')
    expect(slider).to_have_attribute('aria-valuetext','2.5×')
    frame=page.locator('.inspection-frame');frame.hover(position={'x':50,'y':50})
    assert frame.evaluate('e=>e.style.getPropertyValue("--pan-x")')
    page.get_by_role('button',name='Whole artwork',exact=True).click();expect(slider).to_have_attribute('aria-valuetext','1.0×')
    for name in ['Drawings','Sculptures','Paintings','All works']:
     page.get_by_role('button',name=name,exact=True).click()
    expect(page.locator('.art-card')).to_have_count(5)
    for selector in ['#collection','#closer','#artist','#delivery']:
     page.locator(selector).scroll_into_view_if_needed();page.wait_for_timeout(250)
    page.locator('#artist img').evaluate('(img)=>img.decode()')
    page.screenshot(path=str(OUT/'desktop-full.png'),full_page=True)
    page.evaluate('window.scrollTo({top:document.body.scrollHeight,behavior:"instant"})')
    page.wait_for_function('parseFloat(document.querySelector(".storefront").style.getPropertyValue("--gallery-progress"))>0')
    context.close()
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,record_video_dir=str(OUT/'mobile-recording'),record_video_size={'width':390,'height':844});page=mobile.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'/en',wait_until='networkidle');page.wait_for_timeout(700);page.screenshot(path=str(OUT/'mobile-opening.png'))
    assert page.locator('.hero-original').bounding_box()['y']<750
    page.get_by_role('button',name='Enter the gallery',exact=True).tap();dialog=page.get_by_role('dialog')
    expect(dialog.get_by_role('heading',name='Atitlan',exact=True)).to_be_visible()
    dialog.get_by_role('button',name='Next artwork',exact=True).tap();expect(dialog.get_by_role('heading',name='Gato',exact=True)).to_be_visible()
    box=dialog.locator('.exhibition-original').bounding_box();cdp=mobile.new_cdp_session(page)
    x=box['x']+box['width']*.8;y=box['y']+box['height']*.5
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for offset in [20,50,90,130]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-offset,'y':y}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    expect(dialog.get_by_role('heading',name='Mar2',exact=True)).to_be_visible()
    page.screenshot(path=str(OUT/'mobile-gallery.png'))
    dialog.get_by_role('button',name='Leave the gallery').tap()
    expect(dialog).to_have_count(0)
    page.get_by_role('button',name='Open menu',exact=True).tap();expect(page.locator('.mobile-nav')).to_be_visible()
    page.get_by_role('button',name='Close menu',exact=True).tap();expect(page.locator('.mobile-nav')).not_to_be_visible()
    page.locator('#closer').scroll_into_view_if_needed();page.get_by_role('button',name='Look closer',exact=True).tap()
    expect(page.get_by_role('slider',name='Photograph magnification')).to_have_attribute('aria-valuetext','1.8×')
    page.screenshot(path=str(OUT/'mobile-inspector.png'))
    mobile.close()
    context=browser.new_context();page=context.new_page()
    for width in [360,390,768,1024,1440]:
     page.set_viewport_size({'width':width,'height':900})
     for locale in ['en','es','ru','zh','ja','pt']:
      page.goto(BASE+'/'+locale,wait_until='networkidle')
      assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),(locale,width)
      assert page.locator('.hero-original').bounding_box()['y']<750,(locale,width,'art below fold')
      expect(page.locator('.art-card')).to_have_count(5)
    page.set_viewport_size({'width':720,'height':500});page.goto(BASE+'/en');page.evaluate('document.body.style.zoom="2"')
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    context.close()
    for options in [{'reduced_motion':'reduce'},{'java_script_enabled':False}]:
     c=browser.new_context(viewport={'width':390,'height':844},**options);pg=c.new_page();pg.goto(BASE+'/en',wait_until='networkidle')
     expect(pg.locator('.hero-original img')).to_be_visible();expect(pg.locator('.art-card')).to_have_count(5)
     assert not pg.evaluate('document.documentElement.scrollWidth>innerWidth')
     if options.get('reduced_motion'):
      assert pg.locator('.hero-orbit ellipse').first.evaluate('e=>getComputedStyle(e).animationName')=='none'
      pg.get_by_role('button',name='Enter the gallery',exact=True).click();expect(pg.get_by_role('dialog')).to_be_visible();pg.keyboard.press('Escape')
     else:
      pg.locator('.hero-original').click();expect(pg.locator('.original-photo img')).to_be_visible()
     c.close()
    assert not errors,errors
    browser.close();print('PASS: immersive original hero, live selection, gallery keyboard/focus/Escape, touch swipe, honest sold states, original-photo zoom, all filters, 30 locale/widths, 200% zoom, no-JS and reduced-motion.')
  except Exception:
   print('Browser errors:',errors)
   log.seek(0);print(log.read()[-3000:]);raise
  finally:server.terminate();server.wait(timeout=20)
