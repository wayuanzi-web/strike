#!/usr/bin/env python3
"""建置《破曉突擊》。把 src/parts/ 依檔名順序串成單一頁面（照千砲破城的做法）。

  python3 src/build.py
      src/dist/strike.html   Claude Artifact 用的頁面片段（Three.js 從 jsDelivr 載入）
      src/dist/index.html    完整頁面，Three.js 用旁邊的 three.module.min.js（本機測試用）

  python3 src/build.py https://<帳號>.github.io/<repo>/
      另外在 repo 根目錄產生公開網頁 App：index.html、three.module.min.js、sw.js、manifest.webmanifest
      （Three.js 放在 repo 裡，離線也能玩）
"""
import pathlib, re, shutil, sys, time, urllib.parse
root = pathlib.Path(__file__).resolve().parent
parts = root / 'parts'
THREE_VER = '0.160.0'   # r160，固定版本
CDN = f'https://cdn.jsdelivr.net/npm/three@{THREE_VER}/build/three.module.min.js'

head = (parts / '00-head.html').read_text(encoding='utf8')
js_files = sorted(parts.glob('*.js'))
js = '\n'.join(p.read_text(encoding='utf8') for p in js_files)
web_path = root / 'webparts' / '90-web.js'
web_js = web_path.read_text(encoding='utf8') if web_path.exists() else ''

# 標題字型只載畫面上會出現的中文字（HTML 內文＋程式裡的字串，註解不算）
body_html = re.sub(r'<style>.*?</style>', '', head, flags=re.S)
code = re.sub(r'/\*.*?\*/', '', js + web_js, flags=re.S)
code = re.sub(r'(?m)(^|\s)//.*$', '', code)
cjk = sorted(set(ch for ch in body_html + code if '一' <= ch <= '鿿'))
def font_link(href):
    # 用 media="print" 先載、載到再切成 all：網路很差時不會卡住整頁
    return '<link rel="stylesheet" href="' + href + '" media="print" onload="this.media=\'all\'">'
fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         + font_link('https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;800&display=swap')
         + font_link('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@900&display=swap&text=' + urllib.parse.quote(''.join(cjk))))
head = head.replace('<!--FONTS-->', fonts)

# 載入失敗時（例如連不到 CDN）要讓人看得到原因，不要只是一片黑
GUARD = """<script>
(function () {
  function show(msg) { var b = document.getElementById('boot'); if (b) { b.hidden = false; b.textContent = msg; } }
  window.addEventListener('error', function (e) { if (!window.__strike) show('出錯了：' + (e.message || '載入失敗') + '。請重新整理再試一次。'); });
  setTimeout(function () { if (!window.__strike) show('3D 引擎載入太久，請確認網路後重新整理。'); }, 15000);
})();
</script>
"""
def script(code, three_url, test=False):
    pre = 'window.__STRIKE_TEST = true;\n' if test else ''
    return (GUARD + '<script type="module">\n' + pre + "import * as THREE from '" + three_url + "';\n"
            + code + '\n</script>\n')

def full_page(extra_head, code, three_url, test=False):
    cut = head.index('<div id="app"')
    return ('<!doctype html>\n<html lang="zh-Hant"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">'
            + extra_head + head[:cut] + '</head><body>\n' + head[cut:] + '\n' + script(code, three_url, test) + '</body></html>\n')

dist = root / 'dist'; dist.mkdir(exist_ok=True)
frag = head + '\n' + script(js, CDN)
(dist / 'strike.html').write_text(frag, encoding='utf8')
shutil.copy(root / 'vendor' / 'three.module.min.js', dist / 'three.module.min.js')
(dist / 'index.html').write_text(full_page('', js, './three.module.min.js'), encoding='utf8')
(dist / 'test.html').write_text(full_page('', js, './three.module.min.js', test=True), encoding='utf8')
print('built', len(frag) // 1024, 'KB;', len(js_files), 'js parts;', len(cjk), 'cjk glyphs')

if len(sys.argv) > 1:
    url = sys.argv[1].rstrip('/') + '/'
    site = root.parent
    desc = '手機上的第一人稱 3D 槍戰：左手搖桿、右手轉視角，一把步槍對上會巡邏、會還手的機器人。不用帳號，橫拿點開就能玩。'
    meta = ('<meta name="theme-color" content="#0e141d">'
            f'<meta name="description" content="{desc}">'
            '<link rel="manifest" href="manifest.webmanifest">'
            '<link rel="icon" type="image/png" href="icon-192.png"><link rel="apple-touch-icon" href="apple-touch-icon.png">'
            '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
            '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="破曉突擊">'
            '<meta property="og:type" content="website"><meta property="og:title" content="破曉突擊">'
            f'<meta property="og:description" content="{desc}"><meta property="og:image" content="{url}og.png"><meta property="og:url" content="{url}">'
            '<meta name="twitter:card" content="summary_large_image">')
    (site / 'index.html').write_text(full_page(meta, js + '\n' + web_js, './three.module.min.js'), encoding='utf8')
    shutil.copy(root / 'vendor' / 'three.module.min.js', site / 'three.module.min.js')
    shutil.copy(root / 'vendor' / 'three-LICENSE.txt', site / 'three-LICENSE.txt')
    stamp = time.strftime('%Y%m%d%H%M%S')
    sw = (root / 'webparts' / 'sw.js').read_text(encoding='utf8').replace('__CACHE__', 'strike-' + stamp)
    (site / 'sw.js').write_text(sw, encoding='utf8')
    (site / 'manifest.webmanifest').write_text((root / 'webparts' / 'manifest.json').read_text(encoding='utf8'), encoding='utf8')
    (site / '.nojekyll').touch()
    print('web app written to', site, 'for', url, 'cache', 'strike-' + stamp)
