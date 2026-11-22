// Game Jolt browser build (1.6.0): the web build (index.html, run `node tools/build.mjs` first) + the files it loads at run time
// (public/models, audio, tex, img, the KTX2 transcoder), zipped with index.html at the root, as Game Jolt wants an HTML5 build.
// Made for iPhone / iPad players: on a touch screen the page is laid out 1280 CSS px wide like the APK (menus fit) and runs in
// mobile mode; "Add to Home Screen" gives it an icon and full-screen standalone launch.
//   node tools/gamejolt/build-web.mjs   ->   tools/gamejolt/GrannyxDBD-<version>-Web.zip
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = join(dirname(new URL(import.meta.url).pathname), '..', '..'), pub = join(root, 'public'), out = join(root, 'tools/gamejolt/out');
const VERSION = (readFileSync(join(pub, 'js/config.js'), 'utf8').match(/VERSION = '([\d.]+)'/) || [])[1] || 'dev';
if (!existsSync(join(root, 'index.html'))) throw new Error('run node tools/build.mjs first');
rmSync(out, { recursive: true, force: true }); mkdirSync(join(out, 'public'), { recursive: true });
// the files the page fetches (the game looks for public/<x> next to index.html)
for (const d of ['models', 'audio', 'tex', 'img', 'fonts']) if (existsSync(join(pub, d))) cpSync(join(pub, d), join(out, 'public', d), { recursive: true });
cpSync(join(pub, 'vendor/three/addons/libs/basis'), join(out, 'public/vendor/three/addons/libs/basis'), { recursive: true });
// the page: phone layout + home-screen app tags
let html = readFileSync(join(root, 'index.html'), 'utf8');
const head = `<meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Granny x DBD">
  <meta name="theme-color" content="#0a0606">
  <link rel="apple-touch-icon" href="icon-180.png">
  <link rel="manifest" href="manifest.webmanifest">
  <script>
    // phones and tablets: the same 1280-px-wide layout as the APK (the menus are made for it), no pinch zoom, touch controls
    (function () { try { if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
      document.write('<meta name="viewport" content="width=1280, user-scalable=no, viewport-fit=cover">');
      window.__forceTouch = true; document.documentElement.classList.add('mobile');
      // iOS: no long-press callouts / text selection / double-tap zoom on the game
      var s = document.createElement('style'); s.textContent = 'html,body{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:manipulation;overscroll-behavior:none}'; document.head.appendChild(s);
    } else document.write('<meta name="viewport" content="width=device-width, initial-scale=1">'); } catch (e) {} })();
  </script>`;
html = html.replace(/<meta name="viewport"[^>]*>\s*/, ''); // (the script below writes the right one)
html = html.replace('<head>', '<head>\n  ' + head);
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, 'manifest.webmanifest'), JSON.stringify({ name: 'Granny x DBD', short_name: 'Granny x DBD', start_url: './index.html', display: 'fullscreen', orientation: 'landscape', background_color: '#0a0606', theme_color: '#0a0606', icons: [{ src: 'icon-180.png', sizes: '180x180', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 1));
// icons from the Windows app's icon
for (const s of [180, 512]) execFileSync('python3', ['-c', `from PIL import Image\nim=Image.open('${join(root, 'tools/electron/icon.png')}').convert('RGBA').resize((${s},${s}), Image.LANCZOS)\nbg=Image.new('RGBA',im.size,(10,6,6,255)); bg.alpha_composite(im); bg.convert('RGB').save('${join(out, 'icon-' + s + '.png')}')`]);
const zip = join(root, 'tools/gamejolt', `GrannyxDBD-${VERSION}-Web.zip`);
rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-9', zip, '.'], { cwd: out });
console.log('built', zip, (readFileSync(zip).length / 1048576).toFixed(1) + ' MB');
