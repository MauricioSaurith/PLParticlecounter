const $ = id => document.getElementById(id);
const money = n => n == null ? '—' : new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'}).format(n);
let state = null, controller = null;
async function api(path, body, signal) {
  const response = await fetch(path, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal});
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Unable to complete the request. Please try again.');
  }
  return path === '/api/export' ? response.blob() : response.json();
}
function message(text, error=false) { $('message').textContent=text; $('message').className=error?'error':''; }
function render() {
  $('loaded').textContent=state.products.length.toLocaleString('en-US');
  const prices=state.products.map(p=>p.price).filter(p=>p!==null);
  $('average').textContent=prices.length?money(prices.reduce((a,b)=>a+b,0)/prices.length):'—';
  $('sale').textContent=state.products.filter(p=>p.discount>0).length;
  $('progress').max=Math.max(state.total,1); $('progress').value=state.total?state.products.length:1;
  $('table-note').textContent=`${state.products.length} products`;
  const fragment=document.createDocumentFragment();
  for (const p of state.products) {
    const tr=document.createElement('tr');
    for (const [i,value] of [p.name,p.id,money(p.price),p.discount?`${p.discount}%`:'—',p.sport||'—',p.rating==null?'—':p.rating.toFixed(2)].entries()) {
      const td=document.createElement('td');
      if (i===0 && p.url.startsWith('https://www.adidas.com/us/')) {
        const a=document.createElement('a'); a.href=p.url; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent=value; td.append(a);
      } else td.textContent=value;
      tr.append(td);
    }
    fragment.append(tr);
  }
  $('rows').replaceChildren(fragment);
}
function appendPage(page) {
  if (page.total!==state.total || page.page_size!==state.page_size || page.url!==state.url || page.start!==state.products.length) throw new Error('The catalog changed during the request. Please try again.');
  const ids=new Set(state.products.map(p=>p.id));
  for (const p of page.products) { if(ids.has(p.id)) throw new Error('Adidas returned duplicate products across pages. Please try again.'); ids.add(p.id); }
  state.products.push(...page.products); render();
}
async function consult(url) {
  if(controller) return;
  state=null; $('download').disabled=true; $('results').hidden=true; $('submit').disabled=true; $('example').disabled=true; $('url').disabled=true;
  controller=new AbortController(); message('Checking Adidas…');
  try {
    const first=await api('/api/page',{url,start:0},controller.signal);
    state={...first,products:[],complete:false}; $('results').hidden=false; $('cancel').hidden=false;
    $('title').textContent=first.title; $('total').textContent=first.total.toLocaleString('en-US');
    $('timestamp').textContent='Checked: '+new Date(first.fetched_at).toLocaleString('en-US');
    $('verified').textContent='Checking pages'; appendPage(first);
    if(first.total>first.max_products) throw new Error(`The total is ${first.total}. Excel export is limited to ${first.max_products} products; use a more specific category.`);
    while(state.products.length<state.total) {
      message(`Loading products: ${state.products.length} of ${state.total}…`);
      await new Promise(resolve=>setTimeout(resolve,700));
      appendPage(await api('/api/page',{url:state.url,start:state.products.length},controller.signal));
    }
    message('Checking that the first page has not changed…');
    const recheck=await api('/api/page',{url:state.url,start:0},controller.signal);
    if(recheck.total!==first.total || recheck.products.map(p=>p.id).join(',')!==first.products.map(p=>p.id).join(',')) throw new Error('The catalog changed during the request. Please try again.');
    state.complete=true; $('verified').textContent='Count complete · no duplicates'; $('download').disabled=false;
    message(state.total?`Done. ${state.total} unique products. You can download the Excel file.`:'This category has no products. You can download the empty Excel file.');
  } catch(error) {
    message(error.name==='AbortError'?'Request canceled. Run it again to get the complete list.':error.message,true);
    if(state) $('verified').textContent='Unverified list';
  } finally {controller=null; $('submit').disabled=false; $('example').disabled=false; $('url').disabled=false; $('cancel').hidden=true;}
}
$('form').addEventListener('submit',e=>{e.preventDefault();consult($('url').value.trim());});
$('example').addEventListener('click',()=>{$('url').value='https://www.adidas.com/us/men-running-shoes'; $('url').focus();});
$('cancel').addEventListener('click',()=>controller?.abort());
$('download').addEventListener('click',async()=>{
  $('download').disabled=true;
  try {
    const blob=await api('/api/export',state); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url;a.download='adidas-products.xlsx';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){message(error.message,true);}
  finally{$('download').disabled=!state?.complete;}
});
