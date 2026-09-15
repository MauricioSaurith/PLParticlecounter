const $ = id => document.getElementById(id);
const markets = {US:{base:'https://www.adidas.com/us/',currency:'USD'},CA:{base:'https://www.adidas.ca/en/',currency:'CAD'}};
let selectedMarket='US';
const money = n => n == null ? '—' : new Intl.NumberFormat('en-US', {style:'currency', currency:markets[selectedMarket].currency}).format(n);
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
      if (i===0 && p.url.startsWith(markets[selectedMarket].base)) {
        const a=document.createElement('a'); a.href=p.url; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent=value; td.append(a);
      } else td.textContent=value;
      tr.append(td);
    }
    fragment.append(tr);
  }
  $('rows').replaceChildren(fragment);
}
function appendPage(page) {
  if (page.market!==selectedMarket || page.currency!==markets[selectedMarket].currency || page.total!==state.total || page.page_size!==state.page_size || page.url!==state.url || page.start!==state.products.length) throw new Error('The catalog changed during the request. Please try again.');
  const ids=new Set(state.products.map(p=>p.id));
  for (const p of page.products) { if(ids.has(p.id)) throw new Error('Adidas returned duplicate products across pages. Please try again.'); ids.add(p.id); }
  state.products.push(...page.products); render();
}
async function consult(url) {
  if(controller) return;
  if (!url.startsWith(markets[selectedMarket].base)) { message("Use a URL for the selected market.",true); return; }
  for (const key of Object.keys(markets)) $("tab-"+key).disabled=true;
  state=null; $('download').disabled=true; $('results').hidden=true; $('submit').disabled=true; $('example').disabled=true; $('url').disabled=true;
  controller=new AbortController(); message('Checking Adidas…');
  try {
    const first=await api('/api/page',{url,start:0,market:selectedMarket},controller.signal);
    state={...first,products:[],complete:false}; renderFilters(first); $('results').hidden=false; $('cancel').hidden=false;
    $('title').textContent=first.title; $('total').textContent=first.total.toLocaleString('en-US');
    $('timestamp').textContent='Checked: '+new Date(first.fetched_at).toLocaleString('en-US');
    $('verified').textContent='Checking pages'; appendPage(first);
    if(first.total>first.max_products) throw new Error(`The total is ${first.total}. Excel export is limited to ${first.max_products} products; use a more specific category.`);
    while(state.products.length<state.total) {
      message(`Loading products: ${state.products.length} of ${state.total}…`);
      await new Promise(resolve=>setTimeout(resolve,700));
      appendPage(await api('/api/page',{url:state.url,start:state.products.length,market:selectedMarket},controller.signal));
    }
    message('Checking that the first page has not changed…');
    const recheck=await api('/api/page',{url:state.url,start:0,market:selectedMarket},controller.signal);
    if(recheck.total!==first.total || recheck.products.map(p=>p.id).join(',')!==first.products.map(p=>p.id).join(',')) throw new Error('The catalog changed during the request. Please try again.');
    state.complete=true; $('verified').textContent='Count complete · no duplicates'; $('download').disabled=false;
    message(state.total?`Done. ${state.total} unique products. You can download the Excel file.`:'This category has no products. You can download the empty Excel file.');
  } catch(error) {
    message(error.name==='AbortError'?'Request canceled. Run it again to get the complete list.':error.message,true);
    if(state) $('verified').textContent='Unverified list';
  } finally {for (const key of Object.keys(markets)) $("tab-"+key).disabled=false; controller=null; $('submit').disabled=false; $('example').disabled=false; $('url').disabled=false; $('cancel').hidden=true;}
}
$('form').addEventListener('submit',e=>{e.preventDefault();consult($('url').value.trim());});
$('example').addEventListener('click',()=>{$('url').value=markets[selectedMarket].base+'men-running-shoes'; $('url').focus();});
$('cancel').addEventListener('click',()=>controller?.abort());
$('download').addEventListener('click',async()=>{
  $('download').disabled=true;
  const exportMarket=selectedMarket;
  try {
    const blob=await api('/api/export',state); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url;a.download=`adidas-${exportMarket.toLowerCase()}-products.xlsx`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){message(error.message,true);}
  finally{$('download').disabled=!state?.complete;}
});

function selectMarket(key) {
  if(controller) return;
  selectedMarket=key; state=null;
  for(const market of Object.keys(markets)) {
    $('tab-'+market).setAttribute('aria-selected',String(market===key));
    $('tab-'+market).tabIndex=market===key?0:-1;
  }
  $('market-panel').setAttribute('aria-labelledby','tab-'+key);
  $('market-label').textContent=$('market-hint').textContent='Adidas '+key;
  $('currency-note').textContent=markets[key].currency+' · products loaded';
  $('price-header').textContent='Price '+markets[key].currency;
  $('url').value=''; $('url').placeholder=markets[key].base+'men-running-shoes';
  $('results').hidden=true; $('download').disabled=true;
  message('Paste a link to get started.');
}
for(const key of Object.keys(markets)) {
  $('tab-'+key).addEventListener('click',()=>selectMarket(key));
  $('tab-'+key).addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {
      e.preventDefault(); const next=e.key==='Home'?'US':e.key==='End'?'CA':key==='US'?'CA':'US';
      selectMarket(next); $('tab-'+next).focus();
    }
  });
}

function renderFilters(data) {
  $('filter-info').hidden=false;
  $('filter-groups').replaceChildren();
  if(!Array.isArray(data.filters)) {
    $('filter-total').textContent='Filter information unavailable'; return;
  }
  $('filter-total').textContent=`${data.filters.length} filter groups`;
  if(!data.filters.length) $('filter-groups').textContent='No filters were returned for this category.';
  for(const group of data.filters) {
    const details=document.createElement('details'); details.className='filter-group';
    const summary=document.createElement('summary');
    summary.textContent=`${group.name} · ${group.kind==='range'?'Price range':`${group.option_count} options`}`;
    details.append(summary);
    const list=document.createElement('ul');
    for(const option of group.options) {
      const li=document.createElement('li');
      const label=document.createElement('span');label.textContent=group.kind==='range'?money(Number(option.value)):option.name;
      const count=document.createElement('span');count.className='muted';
      count.textContent=group.kind==='range'?'Range boundary':option.product_count==null?'Count unavailable':`${option.product_count} products`;
      li.append(label,count); list.append(li);
    }
    details.append(list);$('filter-groups').append(details);
  }
}
