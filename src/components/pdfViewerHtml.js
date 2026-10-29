import { PDF_LIB, PDF_WORKER } from '../pdfjsBundle';

const esc = (s) => s.replace(/<\/script/gi, '<\\/script');

// Visor de PDF 100% offline (pdf.js embutido). Recebe o arquivo em pedaços via window.__chunk,
// renderiza só as páginas perto da tela e libera as distantes (memória baixa em PDFs grandes).
// Camada de texto selecionável + marca-texto (retângulos coloridos por página) + ir para página.
export default function pdfViewerHtml() {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes">
<style>
html,body{margin:0;background:#050d24}
.pg{position:relative;margin:0 auto 6px;background:#fff;width:100%;overflow:hidden}
.pg canvas{position:absolute;left:0;top:0;width:100%;height:100%;z-index:0}
.hlr{position:absolute;z-index:1;border-radius:2px;pointer-events:none}
.textLayer{position:absolute;left:0;top:0;z-index:2;line-height:1;-webkit-user-select:text;user-select:text}
.textLayer span,.textLayer br{color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0 0}
.textLayer ::selection{background:rgba(61,139,255,.35)}
#m{color:#8fa3cf;font:14px sans-serif;padding:20px}
</style>
</head><body><div id="m">Carregando…</div><div id="p"></div>
<script>${esc(PDF_LIB)}</script>
<script>
var WORKER_SRC=${esc(JSON.stringify(PDF_WORKER))};
pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([WORKER_SRC],{type:'text/javascript'}));
var buf=null,off=0,pdf=null,pages=[],ratio=1.4,startPage=0,pending=[],st=null;
function post(o){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(o))}
window.__start=function(size,page){buf=new Uint8Array(size);off=0;startPage=page||0};
window.__chunk=function(b64){var r=atob(b64);for(var i=0;i<r.length;i++)buf[off+i]=r.charCodeAt(i);off+=r.length};
window.__end=function(){
  pdfjsLib.getDocument({data:buf}).promise.then(function(d){
    pdf=d;buf=null;document.getElementById('m').remove();
    return pdf.getPage(1)
  }).then(function(p){
    var vp=p.getViewport({scale:1});ratio=vp.height/vp.width;build();
  }).catch(function(e){document.getElementById('m').textContent='Erro ao abrir PDF: '+e.message});
};
function build(){
  var root=document.getElementById('p'),w=root.clientWidth||window.innerWidth;
  for(var n=1;n<=pdf.numPages;n++){
    var d=document.createElement('div');d.className='pg';d.style.height=(w*ratio)+'px';d.dataset.n=n;root.appendChild(d);pages.push({el:d,state:0});
  }
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    var pg=pages[e.target.dataset.n-1];
    if(e.isIntersecting)render(pg,+e.target.dataset.n);else release(pg);
  })},{rootMargin:'1500px 0px'});
  pages.forEach(function(p){io.observe(p.el)});
  pending.forEach(addMark);pending=[];
  if(startPage>0){window.scrollTo(0,pages[Math.min(startPage,pages.length-1)].el.offsetTop)}
  window.addEventListener('scroll',report,{passive:true});report();
}
function render(pg,n){
  if(pg.state)return;pg.state=1;
  pdf.getPage(n).then(function(p){
    var w=pg.el.clientWidth,base=p.getViewport({scale:1}).width;
    var s=Math.min(2,window.devicePixelRatio||1)*w/base;
    var vp=p.getViewport({scale:s}),css=p.getViewport({scale:w/base});
    var c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;
    pg.el.style.height=css.height+'px';
    return p.render({canvasContext:c.getContext('2d'),viewport:vp}).promise.then(function(){
      if(pg.state!==1){c.width=0;return}
      pg.el.appendChild(c);pg.state=2;
      return p.getTextContent().then(function(tc){
        if(pg.state!==2)return;
        var t=document.createElement('div');t.className='textLayer';t.style.width=css.width+'px';t.style.height=css.height+'px';
        pg.el.appendChild(t);
        pdfjsLib.renderTextLayer({textContent:tc,container:t,viewport:css,textDivs:[]});
      });
    });
  })
}
function release(pg){
  if(!pg.state)return;
  var c=pg.el.querySelector('canvas');if(c){c.width=0;c.remove()}
  var t=pg.el.querySelector('.textLayer');if(t)t.remove();
  pg.state=0;
}
function report(){clearTimeout(st);st=setTimeout(function(){
  var y=window.scrollY+window.innerHeight/3,i=0;
  for(;i<pages.length-1;i++){if(pages[i+1].el.offsetTop>y)break}
  post({t:'page',page:i,total:pages.length})
},300)}

// ---- marca-texto: retângulos normalizados (0..1) dentro da página ----
function addMark(m){
  var pg=pages[m.page];if(!pg)return;
  m.rects.forEach(function(r){
    var d=document.createElement('div');d.className='hlr';d.setAttribute('data-m',m.id);
    d.style.cssText='left:'+r.x*100+'%;top:'+r.y*100+'%;width:'+r.w*100+'%;height:'+r.h*100+'%;background:'+m.color;
    pg.el.appendChild(d);
  });
}
window.__marks=function(list){if(pages.length)list.forEach(addMark);else pending=pending.concat(list)};
window.__addmark=function(m){addMark(m);window.getSelection().removeAllRanges()};
window.__unmark=function(id){document.querySelectorAll('.hlr[data-m="'+id+'"]').forEach(function(d){d.remove()})};
window.__goto=function(n){var p=pages[Math.max(0,Math.min(n,pages.length-1))];if(p)window.scrollTo(0,p.el.offsetTop)};

var selT=null;
document.addEventListener('selectionchange',function(){clearTimeout(selT);selT=setTimeout(function(){
  var s=window.getSelection();
  if(!s||s.isCollapsed||!s.rangeCount){post({t:'rangeClear'});return}
  var r=s.getRangeAt(0),a=r.startContainer.parentElement,pgEl=a&&a.closest('.pg');
  if(!pgEl){post({t:'rangeClear'});return}
  var b=pgEl.getBoundingClientRect(),rects=[];
  Array.prototype.forEach.call(r.getClientRects(),function(c){
    if(c.width<2||c.height<2)return;
    var x=(c.left-b.left)/b.width,y=(c.top-b.top)/b.height;
    if(x<-0.01||y<-0.01||x>1||y>1)return;
    rects.push({x:x,y:y,w:c.width/b.width,h:c.height/b.height});
  });
  if(!rects.length){post({t:'rangeClear'});return}
  post({t:'range',page:+pgEl.dataset.n-1,rects:rects,text:s.toString()});
},300)});
document.addEventListener('click',function(ev){
  if(String(window.getSelection()).length)return;
  var els=document.elementsFromPoint(ev.clientX,ev.clientY);
  // retângulos não recebem toque (ficam sob o texto): testa a posição contra eles
  var hit=null;
  document.querySelectorAll('.hlr').forEach(function(d){
    var b=d.getBoundingClientRect();
    if(ev.clientX>=b.left&&ev.clientX<=b.right&&ev.clientY>=b.top&&ev.clientY<=b.bottom)hit=d;
  });
  if(hit)post({t:'mark',id:hit.getAttribute('data-m')});
});
post({t:'ready'});
</script></body></html>`;
}
