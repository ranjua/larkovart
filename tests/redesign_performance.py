"""Repeatable prelaunch mobile lab profile and room-load failure check; isolated DB."""
import os,subprocess,tempfile,time,signal,json
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=Path('/tmp/larkova-redesign')
with tempfile.TemporaryDirectory(prefix='larkova-redesign-perf-') as d:
 with open(out/'performance-server.log','w') as log:
  server=subprocess.Popen(['npm','run','start','--','--port','3209'],cwd=root,env={**os.environ,'DATABASE_URL':f'file:{d}/db','DATABASE_ENVIRONMENT':'development'},stdout=log,stderr=log,start_new_session=True)
  try:
   for _ in range(90):
    try:
     if urlopen('http://127.0.0.1:3209/en').status==200:break
    except:time.sleep(.5)
   with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=['--disable-gpu']);metrics=[]
    for i in range(3):
     c=b.new_context(viewport={'width':390,'height':844});page=c.new_page();cdp=c.new_cdp_session(page)
     cdp.send('Network.enable');cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':80,'downloadThroughput':200000,'uploadThroughput':100000});cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
     page.add_init_script("window.lab={lcp:0,cls:0};new PerformanceObserver(l=>{for(const e of l.getEntries())window.lab.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.lab.cls+=e.value}).observe({type:'layout-shift',buffered:true});")
     page.goto('http://127.0.0.1:3209/en',wait_until='networkidle');page.wait_for_timeout(1500);metrics.append(page.evaluate('({...window.lab,transfer:performance.getEntriesByType("resource").reduce((n,r)=>n+r.transferSize,0),fonts:performance.getEntriesByType("resource").filter(r=>r.name.includes("/fonts/")).map(r=>r.name.split("/").pop())})'));c.close()
    (out/'after-metrics.json').write_text(json.dumps(metrics,indent=2))
    assert max(m['cls'] for m in metrics)<=.1,'Layout shift exceeds the prelaunch target'
    assert sorted(m['lcp'] for m in metrics)[1]<=2500,'Median mobile lab LCP exceeds the prelaunch target'
    from urllib.parse import unquote
    c=b.new_context(viewport={'width':390,'height':844});page=c.new_page()
    page.route('**/*',lambda route:route.abort() if '/rooms/' in unquote(route.request.url) else route.continue_())
    page.goto('http://127.0.0.1:3209/en/art/atitlan',wait_until='networkidle');page.get_by_role('button',name='See it in a room',exact=True).click()
    expect(page.locator('.fine-print[role=status]')).to_contain_text('Room preview unavailable')
    expect(page.locator('.original-photo.is-visible')).to_be_visible()
    c.close();b.close();print(json.dumps(metrics,indent=2));print('PASS: blocked room images show an honest error while the original remains visible.')
  finally:os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=20)
