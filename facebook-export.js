// Local Facebook XLSX generation: preserve the supplied workbook, replace its sample rows.
// ZIP entries use the standard uncompressed method; no network library is needed.
(function(root){
 'use strict';
 const conditions=['New','Used - Like New','Used - Good','Used - Fair'];
 function prepare(products,categories){
  const errors=[],warnings=[],titles=new Set(),allowed=new Set(categories),mapping=Object.create(null),rows=[];
  for(const product of products){
   const sku=String(product.sku),title=Array.from(String(product.title||'').trim()).slice(0,150).join('');
   if(!title)errors.push(sku+': title is missing.');
   const titleKey=title.toLowerCase();
   if(titles.has(titleKey))errors.push(sku+': duplicate Facebook title “'+title+'”. Rename one product before exporting.');
   titles.add(titleKey);
   const rawPrice=String(product.price??'').trim(),price=Number(rawPrice);
   if(!rawPrice||!Number.isFinite(price)||price<0||!Number.isSafeInteger(Math.round(price)))errors.push(sku+': enter a valid price.');
   if(Number.isFinite(price)&&price!==Math.round(price))warnings.push(sku+': price rounded from '+price+' to '+Math.round(price)+' for Facebook.');
   const condition=String(product.facebookCondition||'');
   if(!conditions.includes(condition))errors.push(sku+': choose a Facebook condition in Edit product.');
   const category=String(product.facebookCategory||'');
   if(category&&!allowed.has(category))errors.push(sku+': choose a category from the Facebook category picker.');
   const images=[...new Set(product.images||[])];
   if(!images.length)errors.push(sku+': no photos saved.');
   if(images.some(url=>{try{return !['https:','http:'].includes(new URL(url).protocol)}catch{return true}}))errors.push(sku+': photos need public image URLs in the sheet.');
   if(images.length>10)warnings.push(sku+': only the first 10 photos will be included.');
   mapping[title]=images.slice(0,10);
   rows.push([title,Math.round(price),condition,String(product.description||'').slice(0,5000),category]);
  }
  return {rows,mapping,errors,warnings};
 }
 function xml(value){return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
 function listingSheet(source,rows){
  if(!rows.length||rows.length>50)throw Error('A Facebook workbook needs 1–50 products.');
  const sheet=source.match(/<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/);
  if(!sheet)throw Error('Invalid Facebook workbook template.');
  const headers=[...sheet[1].matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g)].filter(match=>Number(match[1])<=4).map(match=>match[0]).join('');
  if(!headers.includes('r="4"'))throw Error('Facebook workbook headers are missing.');
  const body=rows.map((values,index)=>{const n=index+5;return '<row r="'+n+'">'+values.map((value,column)=>{const ref='ABCDE'[column]+n;return typeof value==='number'?'<c r="'+ref+'"><v>'+value+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>'}).join('')+'</row>'}).join('');
  return source.replace(sheet[0],()=>'<sheetData>'+headers+body+'</sheetData>').replace(/<dimension\b[^>]*\/>/,'<dimension ref="A1:I'+(rows.length+4)+'"/>');
 }
 const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0});
 function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
 function zip(entries){
  const chunks=[],central=[];let offset=0,centralSize=0;
  function header(size){const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)}}
  for(const [name,bytes] of entries){
   const filename=new TextEncoder().encode(name),crc=crc32(bytes),local=header(30),directory=header(46);
   local.view.setUint32(0,0x04034b50,true);local.view.setUint16(4,20,true);local.view.setUint16(6,0x800,true);local.view.setUint16(12,33,true);local.view.setUint32(14,crc,true);local.view.setUint32(18,bytes.length,true);local.view.setUint32(22,bytes.length,true);local.view.setUint16(26,filename.length,true);
   directory.view.setUint32(0,0x02014b50,true);directory.view.setUint16(4,20,true);directory.view.setUint16(6,20,true);directory.view.setUint16(8,0x800,true);directory.view.setUint16(14,33,true);directory.view.setUint32(16,crc,true);directory.view.setUint32(20,bytes.length,true);directory.view.setUint32(24,bytes.length,true);directory.view.setUint16(28,filename.length,true);directory.view.setUint32(42,offset,true);
   chunks.push(local.bytes,filename,bytes);central.push(directory.bytes,filename);offset+=30+filename.length+bytes.length;centralSize+=46+filename.length;
  }
  const end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,entries.length,true);end.view.setUint16(10,entries.length,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true);
  const result=new Uint8Array(offset+centralSize+22);let cursor=0;for(const chunk of [...chunks,...central,end.bytes]){result.set(chunk,cursor);cursor+=chunk.length}return result;
 }
 function workbook(template,rows){
  const entries=Object.entries(template).map(([name,base64])=>[name,Uint8Array.from(atob(base64),character=>character.charCodeAt(0))]);
  const sheet=entries.find(([name])=>name==='xl/worksheets/sheet1.xml');if(!sheet)throw Error('Facebook workbook template is missing.');
  sheet[1]=new TextEncoder().encode(listingSheet(new TextDecoder().decode(sheet[1]),rows));
  return zip(entries);
 }
 root.InventoryFacebookExport={prepare,workbook,listingSheet,zip,crc32};
})(globalThis);
