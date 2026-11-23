'use strict';
// Small keyboard-accessible pickers; no UI library or native dropdown styling.
function initBillPickers(dateInput,timeInput){
  const $=id=>document.getElementById(id);
  const dateTrigger=$('date-trigger'),timeTrigger=$('time-trigger');
  const datePanel=$('date-popover'),timePanel=$('time-popover');
  const dates=$('date-picker'),times=$('time-picker');
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parse=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(value+'T12:00:00'):new Date();
  const displayTime=value=>{if(!value)return '--:--';const [h,m]=value.split(':').map(Number);return `${String(h%12||12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`};
  let month=parse(dateInput.value),dateClosing,timeClosing;
  function valueLabels(){
    $('date-value').textContent=dateInput.value?dateInput.value.split('-').reverse().join('/'):'dd/mm/yyyy';
    $('time-value').textContent=displayTime(timeInput.value);
    dateTrigger.classList.toggle('empty',!dateInput.value);timeTrigger.classList.toggle('empty',!timeInput.value);
  }
  function close(kind,focus=false){
    const panel=kind==='date'?datePanel:timePanel,trigger=kind==='date'?dateTrigger:timeTrigger;
    trigger.setAttribute('aria-expanded','false');panel.classList.add('is-closing');
    const timer=setTimeout(()=>{panel.hidden=true;panel.classList.remove('is-closing')},130);
    if(kind==='date'){clearTimeout(dateClosing);dateClosing=timer}else{clearTimeout(timeClosing);timeClosing=timer}
    if(focus)trigger.focus({preventScroll:true});
  }
  function position(panel){panel.style.transform='';const r=panel.getBoundingClientRect();const shift=Math.min(0,innerWidth-14-r.right);if(shift)panel.style.marginLeft=shift+'px';else panel.style.marginLeft=''}
  function open(kind){
    const panel=kind==='date'?datePanel:timePanel,trigger=kind==='date'?dateTrigger:timeTrigger;
    close(kind==='date'?'time':'date');
    clearTimeout(kind==='date'?dateClosing:timeClosing);
    if(kind==='date'){month=parse(dateInput.value);renderCalendar()}
    else renderTimes();
    panel.hidden=false;panel.classList.remove('is-closing');trigger.setAttribute('aria-expanded','true');position(panel);
    const selected=panel.querySelector('[aria-selected=true]')||panel.querySelector('button');
    if(selected){selected.focus({preventScroll:true});if(kind==='time')selected.scrollIntoView({block:'nearest'})}
  }
  function choose(input,value,kind){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));valueLabels();close(kind,true)}
  function navIcon(direction){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',direction<0?'M14 6l-6 6 6 6':'M10 6l6 6-6 6');svg.append(p);return svg}
  function renderCalendar(focusValue){
    datePanel.replaceChildren();
    const heading=document.createElement('div');heading.className='calendar-heading';
    for(const direction of [-1,1]){
      const button=document.createElement('button');button.type='button';button.className='calendar-nav';button.setAttribute('aria-label',direction<0?'Previous month':'Next month');button.append(navIcon(direction));
      button.disabled=direction<0&&month.getFullYear()===1900&&month.getMonth()===0||direction>0&&month.getFullYear()===9999&&month.getMonth()===11;
      button.addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()+direction,1);renderCalendar();datePanel.querySelector(`[aria-label="${direction<0?'Previous':'Next'} month"]`)?.focus({preventScroll:true})});
      if(direction<0)heading.append(button);else{const title=document.createElement('span');title.textContent=month.toLocaleDateString('en-GB',{month:'long',year:'numeric'});heading.append(title,button)}
    }
    const grid=document.createElement('div');grid.className='calendar-grid';grid.setAttribute('role','grid');grid.setAttribute('aria-label',month.toLocaleDateString('en-GB',{month:'long',year:'numeric'}));
    for(const day of ['Su','Mo','Tu','We','Th','Fr','Sa']){const cell=document.createElement('span');cell.className='weekday';cell.textContent=day;cell.setAttribute('role','columnheader');grid.append(cell)}
    const year=month.getFullYear(),m=month.getMonth(),first=new Date(year,m,1).getDay(),count=new Date(year,m+1,0).getDate();
    for(let i=0;i<first;i++){const blank=document.createElement('span');blank.setAttribute('aria-hidden','true');grid.append(blank)}
    for(let day=1;day<=count;day++){
      const value=iso(new Date(year,m,day)),button=document.createElement('button');button.type='button';button.className='calendar-day';button.textContent=String(day);button.dataset.date=value;button.setAttribute('role','gridcell');button.setAttribute('aria-label',new Date(year,m,day).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}));button.setAttribute('aria-selected',String(value===dateInput.value));
      button.addEventListener('click',()=>choose(dateInput,value,'date'));
      button.addEventListener('keydown',event=>{const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(!(event.key in offsets))return;event.preventDefault();const target=new Date(year,m,day+offsets[event.key]);if(target.getFullYear()<1900||target.getFullYear()>9999)return;if(target.getMonth()!==m){month=target;renderCalendar(iso(target))}else grid.querySelector(`[data-date="${iso(target)}"]`)?.focus()});grid.append(button);
    }
    datePanel.append(heading,grid);
    if(focusValue)datePanel.querySelector(`[data-date="${focusValue}"]`)?.focus({preventScroll:true});
  }
  function renderTimes(){
    timePanel.replaceChildren();
    for(let minute=0;minute<24*60;minute+=15){
      const value=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`,button=document.createElement('button');button.type='button';button.className='time-option';button.setAttribute('role','option');button.setAttribute('aria-selected',String(value===timeInput.value));button.textContent=displayTime(value);button.dataset.time=value;
      button.addEventListener('click',()=>choose(timeInput,value,'time'));
      button.addEventListener('keydown',event=>{let target;if(event.key==='ArrowDown')target=button.nextElementSibling;if(event.key==='ArrowUp')target=button.previousElementSibling;if(event.key==='Home')target=timePanel.firstElementChild;if(event.key==='End')target=timePanel.lastElementChild;if(target){event.preventDefault();target.focus();target.scrollIntoView({block:'nearest'})}});timePanel.append(button);
    }
  }
  dateTrigger.addEventListener('click',()=>dateTrigger.getAttribute('aria-expanded')==='true'?close('date'):open('date'));
  timeTrigger.addEventListener('click',()=>timeTrigger.getAttribute('aria-expanded')==='true'?close('time'):open('time'));
  document.addEventListener('pointerdown',event=>{if(!dates.contains(event.target))close('date');if(!times.contains(event.target))close('time')});
  for(const [root,kind]of [[dates,'date'],[times,'time']]){root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close(kind,true)}});root.addEventListener('focusout',()=>setTimeout(()=>{if(!root.contains(document.activeElement))close(kind)},0))}
  dateInput.addEventListener('input',valueLabels);timeInput.addEventListener('input',valueLabels);valueLabels();
}
