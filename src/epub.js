import JSZip from 'jszip';
import { readBase64 } from './files';

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
};

const dirname = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');

function resolvePath(base, href) {
  const clean = decodeURIComponent(href.split('#')[0].split('?')[0]);
  const parts = (clean.startsWith('/') ? clean.slice(1) : base + clean).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };

export async function loadEpub(uri) {
  const zip = await JSZip.loadAsync(await readBase64(uri), { base64: true });
  const container = await zip.file('META-INF/container.xml').async('string');
  const opfPath = attr(container.match(/<rootfile\b[^>]*>/i)[0], 'full-path');
  const opf = await zip.file(opfPath).async('string');
  const base = dirname(opfPath);

  const manifest = {};
  (opf.match(/<item\b[^>]*>/gi) || []).forEach((t) => {
    manifest[attr(t, 'id')] = { href: attr(t, 'href'), type: attr(t, 'media-type') };
  });
  const chapters = (opf.match(/<itemref\b[^>]*>/gi) || [])
    .map((t) => manifest[attr(t, 'idref')])
    .filter((m) => m && /html/.test(m.type || ''))
    .map((m) => resolvePath(base, m.href));
  if (!chapters.length) throw new Error('EPUB sem capítulos legíveis.');

  const title = ((opf.match(/<dc:title[^>]*>([^<]*)</i) || [])[1] || '').trim();
  return { zip, chapters, title };
}

const READER_CSS = `<style>
body{font-family:Georgia,serif;line-height:1.65;margin:0;padding:20px;background:#fafaf7;color:#1c1c1c;font-size:18px}
img,svg{max-width:100%;height:auto}h1,h2,h3{line-height:1.25}
[data-i]{border-radius:6px;transition:background .15s}
.hl{background:rgba(255,209,102,.35);box-shadow:0 0 0 4px rgba(255,209,102,.35)}
.sel{outline:2px solid #3d8bff;outline-offset:3px}
mark.mk{color:inherit;border-radius:3px;padding:0 1px}
@media (prefers-color-scheme:dark){body{background:#050d24;color:#e3eaff}a{color:#7db4ff}}
</style>`;

// Numera os parágrafos, aplica as marcações salvas e avisa o app quando um é tocado.
const PARAGRAPH_JS = `(function(){
var marks=__MARKS__,mks=__MKS__,sel=null,st=null;
var els=[].filter.call(document.querySelectorAll('p,blockquote,li,h2,h3'),function(e){return e.innerText.trim().length>25&&!e.querySelector('p,li')});
els.forEach(function(e,i){e.setAttribute('data-i',i);if(marks.indexOf(i)>-1)e.classList.add('hl')});
function textNodes(p){var w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT,null),a=[],n;while(n=w.nextNode())a.push(n);return a}
function wrap(i,s,e,color,id){
  var p=document.querySelector('[data-i="'+i+'"]');if(!p)return;
  var pos=0;
  textNodes(p).forEach(function(n){
    var len=n.nodeValue.length,a=Math.max(s,pos),b=Math.min(e,pos+len);
    if(a<b){var r=document.createRange();r.setStart(n,a-pos);r.setEnd(n,b-pos);
      var m=document.createElement('mark');m.className='mk';m.setAttribute('data-m',id);m.style.background=color;r.surroundContents(m)}
    pos+=len;
  });
}
function send(o){var s=JSON.stringify(o);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else parent.postMessage({rs:s},'*')}
mks.forEach(function(m){wrap(m.idx,m.start,m.end,m.color,m.id)});
document.addEventListener('selectionchange',function(){clearTimeout(st);st=setTimeout(function(){
  var s=window.getSelection();
  if(!s||s.isCollapsed||!s.rangeCount){send({t:'rangeClear'});return}
  var r=s.getRangeAt(0),a=r.startContainer.parentElement,b=r.endContainer.parentElement;
  var p=a&&a.closest('[data-i]'),q=b&&b.closest('[data-i]');
  if(!p||p!==q){send({t:'rangeClear'});return}
  var pre=document.createRange();pre.selectNodeContents(p);pre.setEnd(r.startContainer,r.startOffset);
  var s0=pre.toString().length,txt=r.toString();
  send({t:'range',i:+p.getAttribute('data-i'),start:s0,end:s0+txt.length,text:txt});
},300)});
document.addEventListener('click',function(ev){
  var mk=ev.target.closest('mark.mk');if(mk){send({t:'mark',id:mk.getAttribute('data-m')});return}
  if(String(window.getSelection()).length)return;
  var e=ev.target.closest('[data-i]');if(!e)return;
  if(sel)sel.classList.remove('sel');
  if(sel===e){sel=null;send({t:'clear'});return}
  sel=e;e.classList.add('sel');
  send({t:'sel',i:+e.getAttribute('data-i'),text:e.innerText.trim(),marked:e.classList.contains('hl')});
});
window.__mark=function(i,on){var e=document.querySelector('[data-i="'+i+'"]');if(e)e.classList.toggle('hl',on)};
window.__mk=function(i,s,e,color,id){wrap(i,s,e,color,id);window.getSelection().removeAllRanges()};
window.__unmk=function(id){document.querySelectorAll('mark[data-m="'+id+'"]').forEach(function(m){m.parentNode.replaceChild(document.createTextNode(m.textContent),m)})};
window.__clear=function(){if(sel){sel.classList.remove('sel');sel=null}};
})();`;

// Monta o HTML de um capítulo com imagens e CSS embutidos (data URIs).
export async function renderChapter(epub, index, marks = [], markers = []) {
  const path = epub.chapters[index];
  const dir = dirname(path);
  let html = await epub.zip.file(path).async('string');
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');

  const inline = async (re, build) => {
    const matches = [...html.matchAll(re)];
    for (const m of matches) {
      const file = epub.zip.file(resolvePath(dir, m[2]));
      if (!file) continue;
      html = html.replace(m[0], await build(m, file));
    }
  };

  await inline(/(<img\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi, async (m, f) => {
    const ext = m[2].split('.').pop().toLowerCase();
    return `${m[1]}data:${MIME[ext] || 'image/jpeg'};base64,${await f.async('base64')}${m[3]}`;
  });
  await inline(/(<link\b[^>]*?\bhref\s*=\s*["'])([^"']+\.css)(["'][^>]*>)/gi, async (_m, f) => `<style>${await f.async('string')}</style>`);

  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [null, html])[1];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${READER_CSS}</head><body>${body}<script>${PARAGRAPH_JS.replace('__MARKS__', JSON.stringify(marks)).replace('__MKS__', JSON.stringify(markers))}</script></body></html>`;
}
