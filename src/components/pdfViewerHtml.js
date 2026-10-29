import { PDF_LIB, PDF_WORKER } from '../pdfjsBundle';

const esc = (s) => s.replace(/<\/script/gi, '<\\/script');

// Visor de PDF 100% offline (pdf.js embutido). Recebe o arquivo em pedaços via window.__chunk,
// renderiza só as páginas perto da tela e libera as distantes (memória baixa em PDFs grandes).
export default function pdfViewerHtml() {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes">
<style>html,body{margin:0;background:#0b0d12}.pg{position:relative;margin:0 auto 6px;background:#151922;width:100%}canvas{display:block;width:100%;height:100%}#m{color:#8f97a8;font:14px sans-serif;padding:20px}</style>
</head><body><div id="m">Carregando…</div><div id="p"></div>
<script>${esc(PDF_LIB)}</script>
<script>
var WORKER_SRC=${esc(JSON.stringify(PDF_WORKER))};
pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([WORKER_SRC],{type:'text/javascript'}));
var buf=null,off=0,pdf=null,pages=[],ratio=1.4,cur=0,startPage=0;
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
  if(startPage>0){window.scrollTo(0,pages[Math.min(startPage,pages.length-1)].el.offsetTop)}
  window.addEventListener('scroll',report,{passive:true});report();
}
function render(pg,n){
  if(pg.state)return;pg.state=1;
  pdf.getPage(n).then(function(p){
    var w=pg.el.clientWidth,s=Math.min(2,window.devicePixelRatio||1)*w/p.getViewport({scale:1}).width;
    var vp=p.getViewport({scale:s}),c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;
    pg.el.style.height=(w*vp.height/vp.width)+'px';
    return p.render({canvasContext:c.getContext('2d'),viewport:vp}).promise.then(function(){
      if(pg.state!==1){c.width=0;return}pg.el.appendChild(c);pg.state=2;
    });
  })
}
function release(pg){
  if(!pg.state)return;var c=pg.el.querySelector('canvas');if(c){c.width=0;c.remove()}pg.state=0;
}
var t=null;
function report(){clearTimeout(t);t=setTimeout(function(){
  var y=window.scrollY+window.innerHeight/3,i=0;
  for(;i<pages.length-1;i++){if(pages[i+1].el.offsetTop>y)break}
  if(i!==cur||true){cur=i;post({page:i,total:pages.length})}
},300)}
post({ready:true});
</script></body></html>`;
}
