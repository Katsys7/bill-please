'use strict';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const FONT = '"Libre Baskerville", Helvetica, sans-serif';
const SANS = '"DM Sans", Helvetica, sans-serif';
const HAND = '"Indie Flower", Helvetica, sans-serif';
const DRAFT_KEY = 'bill-please-draft-v2';
const FINAL_KEY = 'bill-please-final-v2';
const {PAPERS,STYLES,MAX_ITEMS,dateIsValid,timeIsValid,normalize,complete}=BillData;
const measureCanvas = document.createElement('canvas');
const measure = measureCanvas.getContext('2d');
let currentBill;

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function localTime() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2,'0')}:${String(Math.floor(date.getMinutes()/15)*15).padStart(2,'0')}`;
}
function blankBill() {
  return {v:2,title:'',subtitle:'',hasSubtitle:false,location:'',date:localDate(),time:localTime(),items:[{name:'',cost:''}],total:'',note:'',paper:'white',style:'perforated'};
}
function readStored(key) {try {const raw=localStorage.getItem(key);return raw?normalize(JSON.parse(raw)):null} catch {return null}}
function storeBill(key,value) {if(new URLSearchParams(location.search).has('demo'))return;try{localStorage.setItem(key,JSON.stringify(value))}catch{/* The link still carries a complete bill when storage is unavailable. */}}
function encodeBill(value) {
  const bytes=new TextEncoder().encode(JSON.stringify(normalize(value)));
  let binary=''; for(const byte of bytes) binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeBill(hash) {
  const encoded=hash.replace(/^#/,'');
  if(!encoded||encoded.length>50000||!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('Invalid link');
  const binary=atob(encoded.replace(/-/g,'+').replace(/_/g,'/'));
  const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  return normalize(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
function dateLabel(value) {return dateIsValid(value)?value.split('-').reverse().join('/'):'DD/MM/YYYY'}
function timeLabel(value) {
  if(!timeIsValid(value))return '--:--';
  const [hour,minute]=value.split(':').map(Number);
  return `${String(hour%12||12).padStart(2,'0')}:${String(minute).padStart(2,'0')} ${hour>=12?'PM':'AM'}`;
}

// The SVG preview and the PNG use these same measured drawing commands.
function font(size,family=FONT,weight=400) {return `${weight} ${size}px ${family}`}
function wrap(value,width,size,family=FONT,spacing=0) {
  measure.font=font(size,family);
  const lines=[];
  for(const paragraph of String(value).split('\n')) {
    let line='';
    for(const char of Array.from(paragraph)) {
      if(line&&measure.measureText(line+char).width+Math.max(0,Array.from(line+char).length-1)*spacing>width) {
        const space=line.lastIndexOf(' ');
        if(space>line.length*.45) {lines.push(line.slice(0,space));line=line.slice(space+1)+char}
        else {lines.push(line);line=char}
      } else line+=char;
    }
    lines.push(line);
  }
  return lines;
}
function layoutBill(bill) {
  const width=360,pad=29,inner=width-pad*2,commands=[];
  let y=41;
  function text(value,size,{align='left',maxWidth=inner,lineHeight=size*1.55,family=FONT,spacing=family===HAND?size*.03:0}={}) {
    for(const line of wrap(value,maxWidth,size,family,spacing)) {
      commands.push({kind:'text',text:line,size,family,spacing,x:align==='center'?width/2:pad,y,align});
      y+=lineHeight;
    }
  }
  function rule(){commands.push({kind:'rule',y});y+=22}
  function pair(left,right,size=13,leftFamily=FONT) {
    const leftLines=wrap(left,178,size,leftFamily),rightLines=wrap(right,106,size,FONT);
    for(let i=0;i<Math.max(leftLines.length,rightLines.length);i++) {
      if(leftLines[i]!==undefined)commands.push({kind:'text',text:leftLines[i],size,family:leftFamily,weight:leftFamily===SANS?700:400,color:leftFamily===SANS?'#757a71':undefined,x:pad,y,align:'left'});
      if(rightLines[i]!==undefined)commands.push({kind:'text',text:rightLines[i],size,family:FONT,x:width-pad,y,align:'right'});
      y+=size*1.55;
    }
    y+=10;
  }
  text(bill.title.trim()||'TITLE',23,{align:'center',lineHeight:30});
  if(bill.hasSubtitle&&bill.subtitle.trim()){y+=2;text(bill.subtitle,12,{align:'center',lineHeight:19})}
  y+=18;
  commands.push({kind:'text',text:'DATE',size:9.5,family:SANS,weight:700,color:'#757a71',x:pad,y,align:'left'});
  commands.push({kind:'text',text:'TIME',size:9.5,family:SANS,weight:700,color:'#757a71',x:width-pad,y,align:'right'});
  y+=17;
  commands.push({kind:'text',text:dateLabel(bill.date),size:12,family:SANS,x:pad,y,align:'left'});
  commands.push({kind:'text',text:timeLabel(bill.time),size:12,family:SANS,x:width-pad,y,align:'right'});
  const locationLines=bill.location.trim()?wrap(bill.location.trim(),132,11,SANS):[];
  locationLines.forEach((line,index)=>commands.push({kind:'text',text:line,size:11,family:SANS,x:width/2,y:y+index*15,align:'center'}));
  y+=20+Math.max(0,locationLines.length-1)*15;rule();
  commands.push({kind:'text',text:'ITEM',size:11,family:SANS,weight:700,color:'#757a71',x:pad,y,align:'left'});
  commands.push({kind:'text',text:'COST',size:11,family:SANS,weight:700,color:'#757a71',x:width-pad,y,align:'right'});
  y+=25;
  bill.items.forEach(item=>pair(item.name.trim(),item.cost.trim()));
  y+=1;rule();pair('TOTAL',bill.total,13,SANS);
  if(bill.note.trim()){y+=15;text(bill.note,21,{align:'center',family:HAND,lineHeight:25});y+=6}
  y+=12;
  const bars=Array.from({length:63},(_,i)=>(i*i*7+i*13+3)%4+1);
  const barWidth=bars.reduce((sum,value)=>sum+value,0)+bars.length-1;
  const factor=inner/barWidth;
  let x=pad;
  for(const bar of bars){commands.push({kind:'bar',x,y,width:bar*factor,height:34});x+=(bar+1)*factor}
  y+=61;
  return {width,height:Math.ceil(y),commands};
}
// A fixed seed keeps the worn edge identical in SVG previews and PNG exports.
function paperOutline(width,height) {
  let seed=183;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  let path='M1 7',x=1,y=7;
  while(x<width-1){x=Math.min(width-1,x+4+random()*7);path+=` L${x.toFixed(2)} ${(2+random()*7).toFixed(2)}`}
  while(y<height-8){y=Math.min(height-8,y+12+random()*21);path+=` L${(width-1-random()*2).toFixed(2)} ${y.toFixed(2)}`}
  x=width-1;
  while(x>1){x=Math.max(1,x-4-random()*8);path+=` L${x.toFixed(2)} ${(height-2-random()*7).toFixed(2)}`}
  while(y>7){y=Math.max(7,y-14-random()*22);path+=` L${(1+random()*2).toFixed(2)} ${y.toFixed(2)}`}
  return path+' Z';
}
function svgNode(tag,attributes={}) {
  const element=document.createElementNS(NS,tag);
  for(const [key,value]of Object.entries(attributes))element.setAttribute(key,String(value));
  return element;
}
function paperMarks(paper,width,height) {
  const marks=[];
  let seed=27;
  function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
  if(paper==='vintage') {
    for(let i=0;i<Math.ceil(width*height/330);i++) {
      const x=random()*width,y=random()*height;
      marks.push({kind:'line',x,y,x2:x+random()*4-2,y2:y+random()*4-2,opacity:.12,color:'#796344'});
    }
    for(let i=0;i<90;i++)marks.push({kind:'circle',x:random()*width,y:random()*height,radius:random()*.8+.2,color:'#796344',opacity:.10});
  } else if(paper==='mint') {
    for(let i=0;i<Math.ceil(width*height/700);i++) {
      const x=random()*width,y=random()*height;
      marks.push({kind:'line',x,y,x2:x+3,y2:y+1,opacity:.12,color:'#687660'});
    }
  }
  return marks;
}
function styleMarks(style,width,height) {
  const marks=[];
  if(style==='coffee') {
    let seed=715;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    const cx=width-43,cy=76,rx=53,ry=55;
    const outer=t=>1+.009*Math.sin(t*3)+.006*Math.cos(t*7)+.003*Math.sin(t*31);
    const thickness=t=>.048+.016*Math.sin(t*2+.3)+.006*Math.cos(t*13);
    function band(offset=0,thin=1){
      const points=[];
      for(let i=0;i<=240;i++){const t=i/240*Math.PI*2,r=outer(t)+offset;points.push([cx+Math.cos(t)*rx*r,cy+Math.sin(t)*ry*r])}
      for(let i=240;i>=0;i--){const t=i/240*Math.PI*2,r=outer(t)+offset-thickness(t)*thin;points.push([cx+Math.cos(t)*rx*r,cy+Math.sin(t)*ry*r])}
      return points.map((v,j)=>`${j?'L':'M'}${v[0].toFixed(2)} ${v[1].toFixed(2)}`).join(' ')+' Z';
    }
    marks.push({kind:'path',d:band(),color:'#8c5725',opacity:.18});
    marks.push({kind:'path',d:band(.007,.24),color:'#754114',opacity:.18});
    for(let i=0;i<16;i++){
      const start=random()*Math.PI*2,length=.09+random()*.26,points=[];
      for(let j=0;j<=12;j++){const t=start+length*j/12,r=outer(t);points.push([cx+Math.cos(t)*rx*r,cy+Math.sin(t)*ry*r])}
      for(let j=12;j>=0;j--){const t=start+length*j/12,r=outer(t)-(.025+random()*.01)*Math.sin(j/12*Math.PI);points.push([cx+Math.cos(t)*rx*r,cy+Math.sin(t)*ry*r])}
      marks.push({kind:'path',d:points.map((v,j)=>`${j?'L':'M'}${v[0].toFixed(2)} ${v[1].toFixed(2)}`).join(' ')+' Z',color:'#794818',opacity:.12+random()*.12});
    }
    for(let i=0;i<210;i++){const t=random()*Math.PI*2,r=outer(t)-random()*.055+(random()-.5)*.04;marks.push({kind:'circle',x:cx+Math.cos(t)*rx*r,y:cy+Math.sin(t)*ry*r,radius:.10+random()*.28,color:'#805022',opacity:.12+random()*.22})}
    for(const [x,y,r]of [[width-91,130,1.5],[width-104,114,.8],[width-16,142,1.3],[width-100,28,.6],[width-86,139,.45]])marks.push({kind:'circle',x,y,radius:r,color:'#805022',opacity:.20});
  }
  return marks;
}
function svgMark(mark) {
  const attributes={opacity:mark.opacity};
  if(mark.kind==='line')return svgNode('line',{...attributes,x1:mark.x,y1:mark.y,x2:mark.x2,y2:mark.y2,stroke:mark.color,'stroke-width':.6});
  if(mark.kind==='circle')return svgNode('circle',{...attributes,cx:mark.x,cy:mark.y,r:mark.radius,fill:mark.color});
  return svgNode('path',{...attributes,d:mark.d,fill:mark.color,'fill-rule':'evenodd'});
}
function canvasMark(ctx,mark) {
  ctx.save();ctx.globalAlpha=mark.opacity;ctx.fillStyle=mark.color;ctx.strokeStyle=mark.color;ctx.lineWidth=.6;
  if(mark.kind==='line'){ctx.beginPath();ctx.moveTo(mark.x,mark.y);ctx.lineTo(mark.x2,mark.y2);ctx.stroke()}
  else if(mark.kind==='circle'){ctx.beginPath();ctx.arc(mark.x,mark.y,mark.radius,0,Math.PI*2);ctx.fill()}
  else ctx.fill(new Path2D(mark.d),'evenodd');
  ctx.restore();
}
const crumpledImage=new Image();
crumpledImage.src=new URL('assets/crumpled-paper.png',document.baseURI).href;
const crumpledReady=crumpledImage.decode().catch(()=>{});
function coverImage(ctx,image,width,height){const ratio=Math.max(width/image.naturalWidth,height/image.naturalHeight);const w=image.naturalWidth*ratio,h=image.naturalHeight*ratio;ctx.drawImage(image,(width-w)/2,(height-h)/2,w,h)}
function renderBill(container,bill) {
  const {width,height,commands}=layoutBill(bill),ink=STYLES[bill.style];
  const svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':bill.title.trim()||'Bill'});
  const clipId='paper-'+cryptoRandomId();
  const defs=svgNode('defs'),clip=svgNode('clipPath',{id:clipId});
  clip.append(svgNode('path',{d:paperOutline(width,height)}));defs.append(clip);svg.append(defs);
  const group=svgNode('g',{'clip-path':`url(#${clipId})`});
  group.append(svgNode('rect',{width,height,fill:PAPERS[bill.paper]}));
  for(const mark of [...paperMarks(bill.paper,width,height),...styleMarks(bill.style,width,height)])group.append(svgMark(mark));
  if(bill.style==='crumpled')group.append(svgNode('image',{href:crumpledImage.src,x:0,y:0,width,height,preserveAspectRatio:'xMidYMid slice',opacity:.34,'data-texture':'crumpled'}));
  for(const command of commands) {
    if(command.kind==='text') {
      const node=svgNode('text',{x:command.x,y:command.y,fill:command.color||ink,'font-size':command.size,'font-family':command.family||FONT,'font-weight':command.weight||400,'letter-spacing':command.spacing||0,'text-anchor':{left:'start',right:'end',center:'middle'}[command.align]});
      node.textContent=command.text;group.append(node);
    } else if(command.kind==='rule')group.append(svgNode('line',{x1:29,x2:width-29,y1:command.y,y2:command.y,stroke:ink,'stroke-width':1,'stroke-dasharray':'2 4','stroke-linecap':'round'}));
    else group.append(svgNode('rect',{x:command.x,y:command.y,width:command.width,height:command.height,fill:'#000000','data-barcode':'true'}));
  }
  svg.append(group);
  svg.append(svgNode('path',{d:paperOutline(width,height),fill:'none',stroke:'#62685b','stroke-width':.85,opacity:.65,'aria-hidden':'true'}));
  const wrapper=document.createElement('div');wrapper.className='bill';wrapper.append(svg);container.replaceChildren(wrapper);
}
let sequence=0;
function cryptoRandomId(){return `${document.body.dataset.page}-${++sequence}`}
function paintText(ctx,command) {
  ctx.fillStyle=command.color||STYLES[currentBill?.style]||'#181a17';
  ctx.font=font(command.size,command.family||FONT,command.weight||400);
  const spacing=command.spacing||0;
  if(!spacing){ctx.textAlign=command.align;ctx.fillText(command.text,command.x,command.y);return}
  const letters=Array.from(command.text),width=ctx.measureText(command.text).width+Math.max(0,letters.length-1)*spacing;
  const start=command.x-(command.align==='center'?width/2:command.align==='right'?width:0);
  ctx.textAlign='left';let prefix='';
  letters.forEach((letter,index)=>{const advance=ctx.measureText(prefix+letter).width-ctx.measureText(letter).width;ctx.fillText(letter,start+advance+index*spacing,command.y);prefix+=letter});
}
async function downloadBill(bill,button) {
  button.disabled=true;
  try {
    await document.fonts.ready;
    if(bill.style==='crumpled')await crumpledReady;
    const {width,height,commands}=layoutBill(bill),scale=3;
    const canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;
    const ctx=canvas.getContext('2d');ctx.scale(scale,scale);
    ctx.save();ctx.clip(new Path2D(paperOutline(width,height)));ctx.fillStyle=PAPERS[bill.paper];ctx.fillRect(0,0,width,height);
    for(const mark of [...paperMarks(bill.paper,width,height),...styleMarks(bill.style,width,height)])canvasMark(ctx,mark);
    if(bill.style==='crumpled'&&crumpledImage.naturalWidth){ctx.save();ctx.globalAlpha=.34;coverImage(ctx,crumpledImage,width,height);ctx.restore()}
    ctx.globalAlpha=1;ctx.fillStyle=STYLES[bill.style];ctx.strokeStyle=STYLES[bill.style];
    for(const command of commands){
      if(command.kind==='text'){paintText(ctx,command)}
      else if(command.kind==='rule'){ctx.lineWidth=1;ctx.lineCap='round';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(29,command.y);ctx.lineTo(width-29,command.y);ctx.stroke();ctx.setLineDash([])}
      else {ctx.fillStyle='#000000';ctx.fillRect(command.x,command.y,command.width,command.height)}
    }
    ctx.restore();
    ctx.save();ctx.strokeStyle='#62685b';ctx.lineWidth=.85;ctx.globalAlpha=.65;ctx.stroke(new Path2D(paperOutline(width,height)));ctx.restore();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('PNG export unavailable');
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`bill-${(bill.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)||'memories')}.png`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  } catch(error){console.error(error);button.setAttribute('aria-label','Download failed. Try again.')}finally{button.disabled=false}
}

let carouselTimer,carouselIntroTimer,carouselActive=0;
function setupHome() {
  clearInterval(carouselTimer);clearTimeout(carouselIntroTimer);
  const samples=[
    {...blankBill(),title:'Sunday, unhurried',location:'Our corner café',hasSubtitle:true,subtitle:'Just us. Nowhere to be.',date:'2026-11-22',time:'10:15',items:[{name:'Coffee, gone cold',cost:'twice'},{name:'A walk with no plan',cost:'47 minutes'},{name:'One long conversation',cost:'overdue'}],total:'a day well spent',note:'Same time next Sunday?',paper:'vintage',style:'perforated'},
    {...blankBill(),title:'One more chapter',hasSubtitle:true,subtitle:'A very good Tuesday',date:'2026-11-17',time:'18:45',items:[{name:'Bookshop detour',cost:'1 hour'},{name:'A story we both loved',cost:'priceless'},{name:'Missing the last bus',cost:'worth it'}],total:'to be continued',note:'Some days deserve a sequel.',paper:'white',style:'coffee'},
    {...blankBill(),title:'After the rain',date:'2026-11-20',time:'16:15',items:[{name:'Sharing one umbrella',cost:'zero dry sleeves'},{name:'Getting a little lost',cost:'20 minutes'},{name:'Laughing about it later',cost:'everything'}],total:'best day with you',note:"I'd take the long way again.",paper:'mint',style:'crumpled'}
  ];
  const carousel=$('samples');carousel.setAttribute('aria-roledescription','carousel');
  const paused=matchMedia('(prefers-reduced-motion:reduce)').matches;
  for(const bill of samples){const slide=document.createElement('div');slide.className='sample-slide';renderBill(slide,bill);carousel.append(slide)}
  const slides=Array.from(carousel.children);
  function position(){carousel.dataset.index=String(carouselActive);slides.forEach((slide,index)=>{const offset=(index-carouselActive+slides.length)%slides.length;slide.dataset.position=String(offset);slide.setAttribute('aria-hidden',String(offset!==0))})}
  function next(direction=1){carouselActive=(carouselActive+direction+slides.length)%slides.length;position()}
  carousel.onkeydown=event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();next(event.key==='ArrowRight'?1:-1)}};
  let startX=0;carousel.onpointerdown=event=>{startX=event.clientX};carousel.onpointerup=event=>{const distance=event.clientX-startX;if(Math.abs(distance)>40)next(distance<0?1:-1)};
  position();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{carousel.classList.add('carousel-visible');carouselIntroTimer=setTimeout(()=>{if(!paused)carouselTimer=setInterval(()=>{if(!document.hidden&&!carousel.matches(':hover')&&!carousel.contains(document.activeElement))next()},5000)},paused?0:650)}));
}
function setupDesign() {
  const params=new URLSearchParams(location.search),fresh=params.has('new'),demo=params.has('demo');
  let draft=demo?{...blankBill(),title:'Sunday, unhurried',hasSubtitle:true,subtitle:'Just us. Nowhere to be.',location:'Our corner café',items:[{name:'Coffee, gone cold',cost:'twice'},{name:'A walk with no plan',cost:'47 minutes'}],total:'a day well spent',note:'Same time next Sunday?'}:fresh?blankBill():(readStored(DRAFT_KEY)||blankBill());
  if(fresh&&!demo){storeBill(DRAFT_KEY,draft);history.replaceState(null,'',location.pathname)}
  currentBill=draft;
  const form=$('bill-form');

  const bindings={'bill-title':'title','bill-subtitle':'subtitle','bill-location':'location','bill-date':'date','bill-time':'time','bill-total':'total','bill-note':'note'};
  function refresh(){renderBill($('live-bill'),draft);storeBill(DRAFT_KEY,draft)}
  for(const [id,key]of Object.entries(bindings)){$(id).value=draft[key];$(id).addEventListener('input',()=>{draft[key]=$(id).value;if(id==='bill-note'){resizeNote();updateNoteCount()}refresh()})}
  for(const name of ['paper','style'])for(const radio of form.querySelectorAll(`input[name=${name}]`)){radio.checked=radio.value===draft[name];radio.addEventListener('change',()=>{draft[name]=radio.value;refresh()})}
  function syncSubtitle(){const on=draft.hasSubtitle;$('subtitle-field').hidden=!on;$('add-subtitle').hidden=on;$('bill-subtitle').disabled=!on}
  $('add-subtitle').addEventListener('click',()=>{draft.hasSubtitle=true;syncSubtitle();refresh();$('bill-subtitle').focus()});
  function renderItems(focusNew=false){
    $('item-fields').replaceChildren();
    draft.items.forEach((item,index)=>{
      const entry=document.createElement('div');entry.className='item-entry';
      const row=document.createElement('div');row.className='two-fields';
      for(const [key,label,max]of [['name','Item',90],['cost','Cost',60]]){
        const field=document.createElement('div');field.className='field';
        const caption=document.createElement('label');caption.htmlFor=`${key}-${index}`;caption.append(document.createTextNode(label+' '));
        const star=document.createElement('span');star.setAttribute('aria-hidden','true');star.textContent='*';caption.append(star);
        const input=document.createElement('input');input.id=`${key}-${index}`;input.name=`${key}-${index}`;input.value=item[key];input.required=true;input.maxLength=max;input.autocomplete='off';input.setAttribute('aria-label',`${label} ${index+1}`);
        if(index===0)input.placeholder=key==='name'?'One long conversation':'Overdue';
        input.addEventListener('input',()=>{draft.items[index][key]=input.value;refresh()});
        const heading=document.createElement('div');heading.className='item-heading';heading.append(caption);
        if(key==='cost'&&index>0){const remove=document.createElement('button');remove.type='button';remove.className='item-remove';remove.setAttribute('aria-label',`Remove item ${index+1}`);remove.textContent='−';remove.addEventListener('click',()=>{draft.items.splice(index,1);renderItems();refresh();$('add-item').focus()});heading.append(remove)}
        field.append(heading,input);row.append(field);
      }
      entry.append(row);
      $('item-fields').append(entry);
    });
    $('add-item').disabled=draft.items.length>=MAX_ITEMS;
    if(focusNew)$(`name-${draft.items.length-1}`).focus();
  }
  $('add-item').addEventListener('click',()=>{if(draft.items.length>=MAX_ITEMS)return;draft.items.push({name:'',cost:''});renderItems(true);refresh()});
  form.addEventListener('submit',event=>{
    event.preventDefault();
    for(const input of form.querySelectorAll('input[required]')){input.value=input.value.trim();if(input.id in bindings)draft[bindings[input.id]]=input.value}
    draft.items=draft.items.map(item=>({name:item.name.trim(),cost:item.cost.trim()}));
    if(!dateIsValid(draft.date)){$('date-trigger').click();return}
    if(!timeIsValid(draft.time)){$('time-trigger').click();return}
    if(!form.reportValidity()||!complete(draft))return;
    submitted=true;storeBill(FINAL_KEY,draft);try{localStorage.removeItem(DRAFT_KEY)}catch{}
    location.href='ready.html'+(demo?'?demo=1':'')+'#'+encodeBill(draft);
  });
  function resizeNote(){const note=$('bill-note');note.style.height='auto';note.style.height=Math.min(Math.max(note.scrollHeight,100),450)+'px'}
  function updateNoteCount(){const length=$('bill-note').value.length;$('note-count').textContent=length+'/100';$('note-count').classList.toggle('over-limit',length>100);$('bill-note').setCustomValidity(length>100?'Please keep the note to 100 characters or fewer.':'')}
  resizeNote();updateNoteCount();
  initBillPickers($('bill-date'),$('bill-time'));
  let submitted=false;
  window.addEventListener('pagehide',()=>{if(!submitted)storeBill(DRAFT_KEY,draft)});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&!submitted)storeBill(DRAFT_KEY,draft)});
  syncSubtitle();renderItems();refresh();
}
const SHARE_CACHE_KEY='bill-please-share-v1';
async function fetchWithTimeout(url,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}
}
async function createShareLink(bill){
  const signature=encodeBill(bill);
  try{const cached=JSON.parse(localStorage.getItem(SHARE_CACHE_KEY));if(cached?.signature===signature&&/^[A-Za-z0-9_-]{16}$/.test(cached.id))return new URL('/b/'+cached.id,location.origin).href}catch{}
  const response=await fetchWithTimeout('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(normalize(bill))});
  if(!response.ok)throw new Error('Share link unavailable');
  const result=await response.json();if(!/^[A-Za-z0-9_-]{16}$/.test(result.id))throw new Error('Invalid share response');
  if(!new URLSearchParams(location.search).has('demo'))try{localStorage.setItem(SHARE_CACHE_KEY,JSON.stringify({signature,id:result.id}))}catch{}
  return new URL('/b/'+result.id,location.origin).href;
}
function setupReady() {
  let bill;
  try{bill=location.hash?decodeBill(location.hash):readStored(FINAL_KEY)}catch{bill=null}
  if(!bill||!complete(bill)){location.replace('design.html');return}
  currentBill=bill;renderBill($('final-bill'),bill);
  const preview=$('preview-link'),status=$('share-status');let sharePromise,shareURL;
  preview.href='#';preview.setAttribute('aria-busy','true');
  function ensureShare(){
    if(!sharePromise)sharePromise=createShareLink(bill).then(url=>{shareURL=url;preview.href=url;preview.removeAttribute('aria-busy');status.hidden=true;return url}).catch(error=>{sharePromise=null;preview.removeAttribute('aria-busy');status.textContent="Couldn't create a share link. Please try again.";status.hidden=false;throw error});
    return sharePromise;
  }
  ensureShare().catch(()=>{});
  $('copy-link').addEventListener('click',async()=>{
    const button=$('copy-link');button.disabled=true;
    try{const url=await ensureShare();try{await navigator.clipboard.writeText(url)}catch{window.prompt('Copy link to share',url);return}button.textContent='Link copied ✓';setTimeout(()=>{button.textContent='Copy link to share'},1800)}
    catch{}finally{button.disabled=false}
  });
  preview.addEventListener('click',event=>{
    if(shareURL)return;
    event.preventDefault();const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
    ensureShare().then(url=>{if(popup)popup.location.replace(url)}).catch(()=>{if(popup)popup.close()});
  });
  $('printer-sound').addEventListener('click',()=>startPrinterAnimation(true));
  $('print').addEventListener('click',()=>downloadBill(bill,$('print')));
  $('create-another').addEventListener('click',()=>{location.href='design.html?new=1'});
}
function revealShareActions(){const actions=document.querySelector('.share-actions');if(actions){actions.classList.add('actions-visible');actions.inert=false}}

let printerStarted=false,printerFinish;
function startPrinterAnimation(replay=false){
  if(printerStarted&&!replay)return;
  const scene=$('printer-scene');if(!scene)return;
  printerStarted=true;scene.classList.remove('printer-pending','is-printing');clearTimeout(printerFinish);
  const audio=$('printer-audio'),actions=document.querySelector('.share-actions');if(actions){actions.classList.remove('actions-visible');actions.inert=true}
  if(matchMedia('(prefers-reduced-motion:reduce)').matches&&!replay){scene.dataset.printState='complete';revealShareActions();return}
  void scene.offsetWidth;scene.classList.add('is-printing');scene.dataset.printState='feeding';
  if(audio){audio.pause();audio.currentTime=0;audio.volume=.45;audio.play().then(()=>{scene.dataset.sound='playing'}).catch(()=>{scene.dataset.sound='blocked'})}
  printerFinish=setTimeout(()=>{scene.classList.remove('is-printing');scene.dataset.printState='complete';revealShareActions();if(audio){audio.pause();audio.currentTime=0}},2400);
}
async function setupShared() {
  const save=$('recipient-print');save.hidden=true;
  try{
    let bill;
    if(location.hash)bill=decodeBill(location.hash);
    else{
      const id=new URLSearchParams(location.search).get('id')||location.pathname.match(/^\/b\/([A-Za-z0-9_-]{16})\/?$/)?.[1];
      if(!id||!/^[A-Za-z0-9_-]{16}$/.test(id))throw new Error('Invalid share link');
      const response=await fetchWithTimeout('/api/bills?id='+encodeURIComponent(id));if(!response.ok)throw new Error('Bill not found');bill=normalize(await response.json());
    }
    if(!complete(bill))throw new Error('Invalid bill');currentBill=bill;await document.fonts.ready;renderBill($('shared-bill'),bill);save.hidden=false;
    save.addEventListener('click',()=>downloadBill(bill,save));
  }catch{const status=$('bill-status');status.textContent="This bill couldn't be loaded. Please check the link and try again.";status.hidden=false}
}

function refreshFontLayout(){
  const page=document.body.dataset.page;
  if(page==='home'){$('samples').replaceChildren();setupHome()}
  else if(currentBill){renderBill($(page==='design'?'live-bill':page==='ready'?'final-bill':'shared-bill'),currentBill);if(page==='ready')startPrinterAnimation()}
}
const setup={home:setupHome,design:setupDesign,ready:setupReady,bill:setupShared};
if(document.body.dataset.page!=='home')setup[document.body.dataset.page]?.();
Promise.allSettled([document.fonts.load('16px '+FONT),document.fonts.load('12px '+SANS),document.fonts.load('21px '+HAND),document.fonts.load('700 12px '+SANS),crumpledReady]).then(refreshFontLayout);
