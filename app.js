'use strict';
(() => {
 const data=window.LECTURE_DATA;
 if(!data?.slides?.length){document.querySelector('#page-title').textContent='课件尚未载入，请刷新页面';return;}
 const $=s=>document.querySelector(s),slides=data.slides,storeKey='office-ai-final-v05';
 let current=-1,view='talk',toastTimer,mediaResize,tocObserver,slideImageRequest=0,controlsTimer;
 // Viewing mode deliberately resets on each visit: first open always includes the script.
 let slidesOnly=false,presenting=false,modeBeforeFullscreen=false,scrollBeforeFullscreen=0,nativeFullscreenEntered=false;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeUrl=u=>/^https?:\/\//i.test(u)?u:'#';
 function linkify(text){const re=/https?:\/\/[^\s<>"）。，；、]+/g;let out='',at=0;for(const m of String(text).matchAll(re)){out+=esc(String(text).slice(at,m.index))+`<a href="${esc(safeUrl(m[0]))}" target="_blank" rel="noopener noreferrer">${esc(m[0])}</a>`;at=m.index+m[0].length;}return out+esc(String(text).slice(at));}
 function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
 async function copy(text){try{await navigator.clipboard.writeText(text);toast('已复制');}catch{toast('无法自动复制，请长按文字或链接复制');}}
 function showDialog(id){const el=$(id);if(el.open)return;if(el.showModal)el.showModal();else el.setAttribute('open','');}
 function closeDialog(id){const el=$(id);if(!el.open&&!el.hasAttribute('open'))return;if(el.close)el.close();else{el.removeAttribute('open');if(id==='#media-dialog')stopMedia();}}
 function route(){const m=location.hash.match(/^#slide-(\d+)(?:-(resources|text))?$/);if(m)return{page:Math.max(1,Math.min(slides.length,Number(m[1]))),view:m[2]||'talk'};let p=1;try{p=Number(localStorage.getItem(storeKey)||1)}catch{}return{page:Math.max(1,Math.min(slides.length,p||1)),view:'talk'};}
 function navigate(page,nextView='talk'){const p=Math.max(1,Math.min(slides.length,page));const hash=`#slide-${p}${nextView==='talk'?'':'-'+nextView}`;if(location.hash===hash){render(p,nextView);return;}location.hash=hash;}
 function resourceMarkup(s){return s.links?.length?`<ul class="resource-list">${s.links.map((r,i)=>`<li><a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.label)} ↗<small>${esc(r.url)}</small></a><button data-copy-link="${i}" aria-label="复制${esc(r.label)}链接">复制</button></li>`).join('')}</ul>`:'<p>本页没有额外工具链接。</p>';}
 function bindResourceCopies(root){root.querySelectorAll('[data-copy-link]').forEach(b=>b.onclick=()=>copy(slides[current].links[Number(b.dataset.copyLink)].url));}
 function openResources(){
  if(slidesOnly||presenting){$('#resource-dialog-content').innerHTML=resourceMarkup(slides[current]);bindResourceCopies($('#resource-dialog-content'));showDialog('#resources-dialog');}
  else navigate(current+1,'resources');
 }
 function renderPanel(){
  const s=slides[current];document.querySelectorAll('[role=tab]').forEach(b=>{const on=b.dataset.view===view;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});$('#content-panel').setAttribute('aria-labelledby','tab-'+view);
  if(view==='talk')$('#content-panel').innerHTML=(s.talk||[]).map(p=>`<p>${linkify(p)}</p>`).join('');
  if(view==='text')$('#content-panel').innerHTML=(s.visualText||[]).map((p,i)=>`<p${i===0?' class="slide-text-lead"':''}>${linkify(p)}</p>`).join('');
  if(view==='resources'){$('#content-panel').innerHTML=resourceMarkup(s);bindResourceCopies($('#content-panel'));}
 }
 function stopMedia(){
  if(mediaResize){mediaResize.disconnect();mediaResize=null;}
  const player=$('#media-player');if(!player)return;
  const video=player.querySelector('video');if(video)video.pause();
  // Removing an embedded player also stops its audio when the dialog is dismissed.
  player.replaceChildren();delete player.dataset.started;
 }
 function playMedia(){
  const m=slides[current].media;if(!m)return;
  showDialog('#media-dialog');
  const player=$('#media-player');if(player.dataset.started){player.querySelector('video')?.play().catch(()=>{});return;}player.dataset.started='yes';
  if(m.type==='mp4'){
   player.innerHTML=`<video controls playsinline webkit-playsinline preload="metadata" poster="${esc(m.poster)}" aria-label="${esc(m.title)}"><source src="${esc(m.src)}" type="video/mp4">当前浏览器不支持视频播放。</video>`;
   const v=player.querySelector('video');v.addEventListener('error',()=>{$('#media-status').textContent='视频暂时无法载入，可以刷新重试或使用下方入口。';});v.play().catch(()=>{$('#media-status').textContent='请点播放器中的播放键。';});
  }else{
   player.innerHTML=`<iframe src="${esc(m.src)}" title="${esc(m.title)}" allow="fullscreen; autoplay; picture-in-picture" allowfullscreen referrerpolicy="${m.provider==='douyin'?'unsafe-url':'strict-origin-when-cross-origin'}"></iframe>`;
   const frame=player.querySelector('iframe'),fit=()=>{frame.style.transform='scale('+player.clientWidth/960+')';};
   Object.assign(frame.style,{position:'absolute',width:'960px',height:'540px',top:'0',left:'0',transformOrigin:'top left'});fit();
   if('ResizeObserver' in window){mediaResize=new ResizeObserver(fit);mediaResize.observe(player);}
   $('#media-status').textContent='播放器来自原平台；若微信内受限，可打开原视频或复制链接到浏览器打开。';
  }
 }
 function renderMedia(s){
  stopMedia();const m=s.media,section=$('#media-section');section.hidden=!m;$('#slide-video-thumb').replaceChildren();
  for(const id of ['#open-video','#presentation-video'])$(id).hidden=!m;
  if(!m){section.replaceChildren();return;}
  $('#media-dialog-title').textContent=m.title||'本页视频';
  section.innerHTML=`<div class="video-card"><div id="media-player" class="video-player${m.type==='mp4'?' portrait':''}"></div><div class="video-footer">${m.original?`<a href="${esc(m.original)}" target="_blank" rel="noopener noreferrer">打开原视频 ↗</a><button class="text-button" id="copy-video">复制视频链接</button>`:`<a href="${esc(m.src)}" target="_blank" rel="noopener">单独打开视频 ↗</a>`}</div><p id="media-status" class="video-status">${esc(m.credit||'点击后播放，可以全屏观看。')}</p></div>`;
  if($('#copy-video'))$('#copy-video').onclick=()=>copy(m.original);
  if(s.videoGeometry&&m.poster){const [x,y,w,h]=s.videoGeometry;$('#slide-video-thumb').innerHTML=`<button class="thumb-play" aria-label="播放本页视频" style="left:${x/19.2}%;top:${y/10.8}%;width:${w/19.2}%;height:${h/10.8}%"><img src="${esc(m.poster)}" alt="视频画面"><span>▶</span></button>`;$('.thumb-play').onclick=playMedia;}
 }
 function fitSlide(){
  if(!slidesOnly&&!presenting)return;
  if(presenting){document.documentElement.style.setProperty('--stage-height',window.innerHeight+'px');return;}
  const top=presenting?$('#presentation-controls').getBoundingClientRect().height:$('.topbar').getBoundingClientRect().height;
  const bottom=$('.page-nav').getBoundingClientRect().height,heading=$('.section-heading').getBoundingClientRect().height;
  const tools=presenting?0:$('.slide-tools').getBoundingClientRect().height+12;
  const available=Math.max(60,window.innerHeight-top-bottom-heading-tools-32);
  document.documentElement.style.setProperty('--stage-height',available+'px');
  document.documentElement.style.setProperty('--display-top',top+'px');
  document.documentElement.style.setProperty('--display-bottom',bottom+'px');
 }
 function revealPresentationControls(){
  if(!presenting)return;document.body.classList.remove('presentation-controls-hidden');clearTimeout(controlsTimer);
  controlsTimer=setTimeout(()=>{
   if(!presenting)return;
   const focused=document.activeElement,inputFocused=focused instanceof Element&&(focused.matches('input,textarea,select')||focused.isContentEditable);
   const keyboardControl=focused instanceof Element&&focused.closest('#presentation-controls,.page-nav')&&focused.matches(':focus-visible');
   // A dialog, typed input or keyboard-focused control must stay visible while it is in use.
   if(document.querySelector('dialog[open]')||inputFocused||keyboardControl){revealPresentationControls();return;}
   document.body.classList.add('presentation-controls-hidden');
  },2500);
 }
 function updateView(){
  document.body.classList.toggle('slides-only',slidesOnly);document.body.classList.toggle('is-presenting',presenting);
  $('#presentation-controls').hidden=!presenting;$('#toggle-view').setAttribute('aria-pressed',String(slidesOnly));$('#toggle-view').textContent=slidesOnly?'课件＋讲稿':'只看课件';
  $('#text-size').hidden=slidesOnly;
  requestAnimationFrame(fitSlide);if(presenting)revealPresentationControls();
 }
 function fullscreenElement(){return document.fullscreenElement||document.webkitFullscreenElement;}
 function leavePresentation(){
  if(!presenting)return;presenting=false;slidesOnly=modeBeforeFullscreen;nativeFullscreenEntered=false;clearTimeout(controlsTimer);document.body.classList.remove('presentation-controls-hidden');updateView();
  requestAnimationFrame(()=>window.scrollTo({top:scrollBeforeFullscreen,behavior:'instant'}));
 }
 async function enterPresentation(){
  if(presenting)return;modeBeforeFullscreen=slidesOnly;scrollBeforeFullscreen=window.scrollY;presenting=true;slidesOnly=true;updateView();window.scrollTo({top:0,behavior:'instant'});
  const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
  if(!request){toast('已进入网页全屏；横屏可获得更大的课件画面。');return;}
  try{await request.call(root);nativeFullscreenEntered=!!fullscreenElement();fitSlide();}catch{toast('已进入网页全屏；可用“退出全屏”返回。');}
 }
 async function exitPresentation(){
  if(fullscreenElement()){const exit=document.exitFullscreen||document.webkitExitFullscreen;try{await exit.call(document);}catch{}}
  leavePresentation();
 }
 function fullscreenChanged(){if(!presenting)return;if(fullscreenElement()){nativeFullscreenEntered=true;fitSlide();}else if(nativeFullscreenEntered)leavePresentation();}
 function loadSlideImage(s,page,retry=false){
  const request=++slideImageRequest,stage=$('#slide-stage'),status=$('#slide-load-status');
  stage.classList.add('is-loading');stage.setAttribute('aria-busy','true');status.hidden=false;
  $('#slide-load-message').textContent='课件加载中…';$('#retry-slide').hidden=true;$('#zoom-slide').disabled=true;$('#zoom-link').disabled=true;
  // Each request owns its image node. A late event from an earlier page cannot reveal stale content.
  const candidate=new Image(1920,1080);candidate.id='slide-image';candidate.alt=`第${page}页：${s.title}`;candidate.fetchPriority='high';candidate.decoding='async';
  let settled=false;
  const finish=ok=>{
   if(settled||request!==slideImageRequest)return;settled=true;
   candidate.onload=null;candidate.onerror=null;
   if(ok){
    $('#slide-image').replaceWith(candidate);stage.classList.remove('is-loading');stage.setAttribute('aria-busy','false');status.hidden=true;$('#zoom-slide').disabled=false;$('#zoom-link').disabled=false;
   }else{
    stage.setAttribute('aria-busy','false');$('#slide-load-message').textContent='课件未能加载，请检查网络后重试。';$('#retry-slide').hidden=false;
   }
  };
  candidate.onload=()=>finish(candidate.naturalWidth>0);candidate.onerror=()=>finish(false);
  let src=s.image;
  if(retry){const url=new URL(src,document.baseURI);if(/^https?:$/.test(url.protocol)){url.searchParams.set('_retry',Date.now());src=url.href;}}
  candidate.src=src;
  // A cached image can be committed within this same frame, without flashing the loading label.
  if(candidate.complete&&candidate.naturalWidth>0)finish(true);
 }
 function render(page,nextView){
  const pageChanged=current!==page-1;
  if(pageChanged){closeDialog('#media-dialog');closeDialog('#resources-dialog');}
  current=page-1;view=nextView;const s=slides[current];
  $('#page-title').textContent=s.title;$('#page-label').textContent=`第 ${page} 页`;$('#chapter').textContent=s.chapter;$('#visual-page').textContent=`${String(page).padStart(2,'0')} / ${slides.length}`;$('#current-page').textContent=page;
  if(pageChanged)loadSlideImage(s,page);$('#prev').disabled=page===1;$('#next').disabled=page===slides.length;$('#progress').style.width=(page/slides.length*100)+'%';document.title=`${page}. ${s.title} · 办公AI讲座`;
  renderPanel();if(pageChanged)renderMedia(s);
  for(const id of ['#open-resources','#presentation-resources'])$(id).hidden=!s.links?.length;
  $('#slide-resource-hotspot').innerHTML=s.resourceGeometry?'<button class="resource-hotspot" aria-label="打开本页工具与资料"></button>':'';
  if(s.resourceGeometry){const [x,y,w,h]=s.resourceGeometry,b=$('.resource-hotspot');Object.assign(b.style,{left:x/19.2+'%',top:y/10.8+'%',width:w/19.2+'%',height:h/10.8+'%'});b.onclick=openResources;}
  try{localStorage.setItem(storeKey,String(page))}catch{}window.scrollTo({top:0,behavior:'instant'});requestAnimationFrame(fitSlide);if(presenting)revealPresentationControls();
  // At most one adjacent slide is prefetched; the directory loads its own thumbnails on demand.
  if(page<slides.length){const next=new Image();next.src=slides[page].image;}
 }
 function toc(query=''){
  if(tocObserver)tocObserver.disconnect();
  const q=query.trim().toLowerCase(),found=slides.filter(s=>!q||(/^\d+$/.test(q)?String(s.page)===q:[s.title,...(s.talk||[]),...(s.visualText||[])].join(' ').toLowerCase().includes(q)));
  $('#toc-empty').hidden=!!found.length;
  $('#toc-list').innerHTML=found.map(s=>`<button class="toc-item" data-page="${s.page}" ${s.page===current+1?'aria-current="page"':''}><img loading="lazy" decoding="async" data-src="${esc(s.thumbnail||s.image)}" width="192" height="108" alt=""><span><small>第 ${String(s.page).padStart(2,'0')} 页 · ${esc(s.chapter)}</small>${esc(s.title)}</span></button>`).join('');
  if('IntersectionObserver' in window){tocObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.src=e.target.dataset.src;tocObserver.unobserve(e.target);}},{root:$('#toc-dialog'),rootMargin:'120px'});$('#toc-list').querySelectorAll('img').forEach(img=>tocObserver.observe(img));}
  else $('#toc-list').querySelectorAll('img').forEach(img=>{img.src=img.dataset.src;});
  $('#toc-list').querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{closeDialog('#toc-dialog');navigate(Number(b.dataset.page));});
 }
 function openToc(){$('#toc-search').value='';showDialog('#toc-dialog');toc();}
 function zoom(){if(presenting){revealPresentationControls();return;}const s=slides[current];$('#zoom-image').src=s.image;$('#zoom-image').alt=s.title;$('#original-image').href=s.image;showDialog('#zoom-dialog');}
 $('#retry-slide').onclick=()=>loadSlideImage(slides[current],current+1,true);
 $('#open-toc').onclick=openToc;$('#page-picker').onclick=openToc;$('#presentation-toc').onclick=openToc;$('#close-toc').onclick=()=>closeDialog('#toc-dialog');$('#toc-search').oninput=e=>toc(e.target.value);
 $('#zoom-slide').onclick=zoom;$('#zoom-link').onclick=zoom;$('#close-zoom').onclick=()=>closeDialog('#zoom-dialog');$('#prev').onclick=()=>navigate(current);$('#next').onclick=()=>navigate(current+2);$('#copy-note').onclick=()=>copy((slides[current].talk||[]).join('\n\n'));
 $('#open-video').onclick=playMedia;$('#presentation-video').onclick=playMedia;$('#close-media').onclick=()=>closeDialog('#media-dialog');$('#media-dialog').addEventListener('close',stopMedia);
 $('#open-resources').onclick=openResources;$('#presentation-resources').onclick=openResources;$('#close-resources').onclick=()=>closeDialog('#resources-dialog');
 $('#toggle-view').onclick=()=>{slidesOnly=!slidesOnly;updateView();window.scrollTo({top:0,behavior:'instant'});};$('#enter-fullscreen').onclick=enterPresentation;$('#exit-fullscreen').onclick=exitPresentation;
 let fontSize=18;try{fontSize=Number(localStorage.getItem(storeKey+'-font'))||18}catch{}document.documentElement.style.setProperty('--note-size',fontSize+'px');$('#text-size').onclick=()=>{fontSize=fontSize>=22?18:fontSize+2;document.documentElement.style.setProperty('--note-size',fontSize+'px');try{localStorage.setItem(storeKey+'-font',fontSize)}catch{}toast('讲稿字号 '+fontSize);};
 document.querySelectorAll('[role=tab]').forEach(b=>{b.onclick=()=>navigate(current+1,b.dataset.view);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const views=['talk','text','resources'],v=views[(views.indexOf(view)+(e.key==='ArrowRight'?1:2))%3];navigate(current+1,v);$('#tab-'+v).focus();};});
 document.addEventListener('keydown',e=>{
  if(presenting)revealPresentationControls();
  if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.isComposing)return;
  if(e.target instanceof Element&&(e.target.closest('input,textarea,select,[role=tab],video')||e.target.isContentEditable||e.target.closest('[contenteditable]:not([contenteditable="false"])')))return;
  if(document.querySelector('dialog[open]'))return;
  if(e.key==='Escape'&&presenting){e.preventDefault();exitPresentation();return;}
  if(e.key==='ArrowLeft'){e.preventDefault();navigate(current);}if(e.key==='ArrowRight'){e.preventDefault();navigate(current+2);}
 });
 for(const id of ['#toc-dialog','#zoom-dialog','#media-dialog','#resources-dialog'])$(id).addEventListener('click',e=>{if(e.target===$(id)){const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(id);}});
 $('#toc-dialog').addEventListener('close',()=>tocObserver?.disconnect());
 document.addEventListener('pointermove',revealPresentationControls,{passive:true});document.addEventListener('pointerdown',revealPresentationControls,{passive:true});document.addEventListener('focusin',revealPresentationControls);
 document.addEventListener('fullscreenchange',fullscreenChanged);document.addEventListener('webkitfullscreenchange',fullscreenChanged);window.addEventListener('resize',fitSlide);window.visualViewport?.addEventListener('resize',fitSlide);
 if('ResizeObserver' in window){const layoutObserver=new ResizeObserver(fitSlide);for(const selector of ['.topbar','.page-nav','#presentation-controls'])layoutObserver.observe($(selector));}
 window.addEventListener('hashchange',()=>{const r=route();render(r.page,r.view);});updateView();const initial=route();render(initial.page,initial.view);
})();
