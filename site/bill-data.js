(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BillData=factory()})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const PAPERS = {vintage:'#f2e7ce', white:'#ffffff', mint:'#e5ebdf'};
const STYLES = {perforated:'#181a17', coffee:'#181a17', crumpled:'#181a17'};
const MAX_ITEMS = 12;
function dateIsValid(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1900-01-01') return false;
  const [year,month,day]=value.split('-').map(Number);
  const date=new Date(year,month-1,day);
  return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day;
}
function timeIsValid(value) {return typeof value==='string'&&/^([01]\d|2[0-3]):(00|15|30|45)$/.test(value)}
function clean(value,max) {return typeof value==='string'?value.slice(0,max):''}
function normalize(value) {
  if(!value||typeof value!=='object'||!Array.isArray(value.items)) throw new Error('Invalid bill');
  return {v:2,title:clean(value.title,60),subtitle:value.hasSubtitle===true?clean(value.subtitle,120):'',hasSubtitle:value.hasSubtitle===true,location:clean(value.location,60),date:dateIsValid(value.date)?value.date:'',time:timeIsValid(value.time)?value.time:'',items:value.items.slice(0,MAX_ITEMS).map(item=>({name:clean(item?.name,90),cost:clean(item?.cost,60)})),total:clean(value.total,70),note:clean(value.note,400),paper:Object.hasOwn(PAPERS,value.paper)?value.paper:({smooth:'white',fiber:'vintage',laid:'mint'}[value.paper]||'white'),style:Object.hasOwn(STYLES,value.style)?value.style:'perforated'};
}
function complete(bill) {
  return !!(bill.title.trim()&&dateIsValid(bill.date)&&timeIsValid(bill.time)&&bill.items.length&&bill.items.every(item=>item.name.trim()&&item.cost.trim()));
}
return {PAPERS,STYLES,MAX_ITEMS,dateIsValid,timeIsValid,normalize,complete};
});
