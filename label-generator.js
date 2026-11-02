/* Six vector QR labels per portrait 4 × 6 inch PDF page. */
(() => {
 'use strict';
 const button=document.createElement('button');
 button.type='button';button.textContent='Generate SKU labels';button.style.cssText='width:100%;margin-bottom:16px';
 document.getElementById('takePhoto').parentElement.after(button);
 const dialog=document.createElement('dialog');
 dialog.setAttribute('aria-labelledby','labelHeading');
 dialog.innerHTML=`<h2 id="labelHeading">SKU label generator</h2><p class="small">Generator v3</p>
 <form id="labelForm">
 <label>Fixed prefix<input name="prefix" placeholder="A1-" maxlength="40" autocomplete="off"></label>
 <p class="small">Enter A1 or A1- to generate A1-001, A1-002, and so on. A dash is added automatically.</p>
 <div class="fields"><label>Start number<input name="start" type="number" value="1" min="0" max="999999999" step="1" required></label>
 <label>Amount<input name="amount" type="number" value="6" min="1" max="1000" step="1" required></label></div>
 <label>Minimum number digits<input name="digits" type="number" value="3" min="1" max="9" step="1" required></label>
 <p id="labelRange" class="readonly" aria-live="polite"></p>
 <p class="small">Six codes per 4 × 6 inch label, arranged 2 across × 3 down. Each QR contains its printed SKU. Print the PDF at actual size (100%) on 4 × 6 paper with no added margins. The last page can have empty spaces. Inventory counters are unchanged.</p>
 <p id="labelStatus" role="status"></p>
 <p><a id="labelDownload" hidden style="color:#73efd4">Download generated PDF</a></p>
 <div class="row"><button type="submit" class="primary">Download PDF</button><button type="button" id="closeLabels">Close</button></div>
 </form>`;
 document.body.append(dialog);
 const form=dialog.querySelector('form'),range=dialog.querySelector('#labelRange'),status=dialog.querySelector('#labelStatus');
 let busy=false,dependencies,pdfUrl;
 function values(){
  const enteredPrefix=form.elements.prefix.value.trim();
  const prefix=enteredPrefix?enteredPrefix.replace(/-+$/,'')+'-':'';
  const start=Number(form.elements.start.value),amount=Number(form.elements.amount.value),digits=Number(form.elements.digits.value);
  if(!form.checkValidity()||![start,amount,digits].every(Number.isSafeInteger)||start+amount-1>999999999)throw Error('Enter a valid range ending at or below 999999999.');
  if(!/^[\x20-\x7e]*$/.test(prefix))throw Error('Use letters, numbers, spaces, and standard punctuation in the prefix.');
  return {prefix,start,amount,digits,sku:i=>prefix+String(start+i).padStart(digits,'0')};
 }
 function preview(){try{const v=values();range.textContent=v.sku(0)+' → '+v.sku(v.amount-1)+'\n'+v.amount+' SKUs · '+Math.ceil(v.amount/6)+' page(s)';status.textContent=''}catch(error){range.textContent=error.message}}
 function script(src,ready){return new Promise((resolve,reject)=>{
  if(ready()){resolve();return}
  const node=document.createElement('script');node.src=src;
  const timer=setTimeout(()=>{node.remove();reject(Error('Library timed out: '+src))},12000);
  node.onload=()=>{clearTimeout(timer);ready()?resolve():reject(Error('PDF tools could not initialize.'))};
  node.onerror=()=>{clearTimeout(timer);node.remove();reject(Error('Could not load library: '+src+'. The server may be unavailable or blocked.'))};document.head.append(node);
 })}
 async function library(name,sources,ready){
  for(const source of sources){
   try{await script(source,ready);return}catch{/* Try the independent backup host. */}
  }
  throw Error(name+' could not load from either library host. This browser or network may be blocking external scripts. Generator v3.');
 }
 function load(){
  if(!dependencies)dependencies=Promise.all([
   library('PDF library',[
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
   ],()=>!!window.jspdf?.jsPDF),
   library('QR library',[
    'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'
   ],()=>typeof window.qrcode==='function')
  ]).catch(error=>{dependencies=null;throw error});
  return dependencies;
 }
 button.onclick=()=>{preview();dialog.showModal()};
 dialog.querySelector('#closeLabels').onclick=()=>dialog.close();
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault()});
 form.addEventListener('input',preview);
 form.onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  let v;try{v=values()}catch(error){status.textContent=error.message;return}
  busy=true;for(const control of form.elements)control.disabled=true;
  dialog.querySelector('#labelDownload').hidden=true;
  status.textContent='Loading PDF tools…';
  try{
   await load();
   const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'pt',format:[288,432],compress:true});
   pdf.setProperties({title:'SKU labels',subject:'Six QR codes per 4 × 6 inch page'});
   pdf.setFont('helvetica','bold');pdf.setFillColor(0);pdf.setTextColor(0);
   for(let i=0;i<v.amount;i++){
    if(i&&i%6===0)pdf.addPage([288,432],'portrait');
    const sku=v.sku(i),qr=window.qrcode(0,'M');qr.addData(sku);qr.make();
    const cell=i%6,x=(cell%2)*144,y=Math.floor(cell/2)*144;
    // A four-module white quiet zone is included inside the 108pt square.
    const count=qr.getModuleCount(),module=108/(count+8),left=x+18+4*module,top=y+10+4*module;
    for(let row=0;row<count;row++)for(let col=0;col<count;){
     if(!qr.isDark(row,col)){col++;continue}
     const start=col;while(col<count&&qr.isDark(row,col))col++;
     pdf.rect(left+start*module,top+row*module,(col-start)*module,module,'F');
    }
    pdf.setFontSize(12);
    const size=Math.min(12,12*124/pdf.getTextWidth(sku));
    if(size<6)throw Error('This prefix makes the SKU too long to print clearly. Shorten the prefix.');
    pdf.setFontSize(size);pdf.text(sku,x+72,y+132,{align:'center'});
    if(i%12===0){status.textContent='Generating '+(i+1)+' of '+v.amount+'…';await new Promise(resolve=>setTimeout(resolve,0))}
   }
   // Keep a real download link available if a mobile browser blocks an async download.
   if(pdfUrl)URL.revokeObjectURL(pdfUrl);
   pdfUrl=URL.createObjectURL(pdf.output('blob'));
   const download=dialog.querySelector('#labelDownload');
   download.href=pdfUrl;download.download='sku-labels-'+v.start+'-'+(v.start+v.amount-1)+'.pdf';download.hidden=false;download.click();
   status.textContent='PDF ready · '+v.amount+' SKUs on '+Math.ceil(v.amount/6)+' page(s).';
  }catch(error){status.textContent=error.message||'Could not generate PDF.'}
  finally{busy=false;for(const control of form.elements)control.disabled=false}
 };
})();
