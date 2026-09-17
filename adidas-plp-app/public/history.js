document.addEventListener('DOMContentLoaded',()=>{
  const el=id=>document.getElementById(id), labels={US:'US',CA:'Canada EN','CA-FR':'Canada FR'};
  let loading=false;
  function svgNode(tag,attrs,text) {const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;}
  function draw(rows) {
    el('history-chart').replaceChildren();el('history-rows').replaceChildren();
    const days=[...new Set(rows.map(r=>r.day))].sort(), values=rows.filter(r=>r.status==='success' && Number.isInteger(r.total));
    const byDay=new Map(rows.map(r=>[r.day+'|'+r.market,r]));
    for(const day of [...days].reverse()) {
      const tr=document.createElement('tr'),date=document.createElement('td');date.textContent=day;tr.append(date);
      for(const market of Object.keys(labels)) {const cell=document.createElement('td'),row=byDay.get(day+'|'+market);cell.textContent=row?.status==='success'?row.total.toLocaleString('en-US'):row?'Failed check':'No record';cell.title=row?row.status==='success'?'Checked '+row.checked_at:row.error||'Check failed':'No observation';tr.append(cell);}
      el('history-rows').append(tr);
    }
    if(!values.length)return;
    const svg=svgNode('svg',{viewBox:'0 0 900 330',role:'img','aria-label':'Daily catalog totals for US, Canada English and Canada French. Exact values are in the table below.'});
    const start=Date.parse(days[0]+'T00:00:00Z'),end=Date.parse(days[days.length-1]+'T00:00:00Z'),max=Math.max(1,...values.map(r=>r.total));
    const x=day=>end===start?475:70+(Date.parse(day+'T00:00:00Z')-start)/(end-start)*790,y=n=>280-n/max*240;
    for(let i=0;i<=4;i++) {const v=max*i/4;svg.append(svgNode('line',{x1:70,x2:860,y1:y(v),y2:y(v),stroke:'#e2e2e2'}),svgNode('text',{x:60,y:y(v)+5,'text-anchor':'end',fill:'#555','font-size':13},Math.round(v).toLocaleString()));}
    svg.append(svgNode('text',{x:70,y:315,fill:'#555','font-size':13},days[0]),svgNode('text',{x:860,y:315,'text-anchor':'end',fill:'#555','font-size':13},days[days.length-1]));
    Object.keys(labels).forEach((market,index)=>{
      let segment=[],previous=null;
      const flush=()=>{if(segment.length>1)svg.append(svgNode('polyline',{points:segment.join(' '),fill:'none',stroke:['#111','#666','#999'][index],'stroke-width':2,'stroke-dasharray':['none','8 5','2 5'][index]}));segment=[];};
      for(const day of days) {
        const row=byDay.get(day+'|'+market),date=Date.parse(day+'T00:00:00Z');
        if(previous!==null && date-previous>86400000)flush();previous=date;
        if(row?.status!=='success'){flush();continue;}
        segment.push(x(day)+','+y(row.total));
        const dot=svgNode('circle',{cx:x(day),cy:y(row.total),r:4,fill:['#111','#666','#999'][index]});dot.append(svgNode('title',{},`${labels[market]} · ${day}: ${row.total.toLocaleString()} products`));svg.append(dot);
      }
      flush();
    });
    el('history-chart').append(svg);
  }
  async function load() {
    if(loading)return;loading=true;el('history-refresh').disabled=true;el('history-status').textContent='Loading history…';
    try {const response=await fetch('/api/history'),data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load history.');draw(data.rows);el('history-status').textContent=data.rows.length?'Daily observations are listed below. A trend appears after at least two successful days.':'No observations yet. The first successful scheduled check starts the history.';}
    catch(e){el('history-status').textContent=e.message;el('history-chart').replaceChildren();el('history-rows').replaceChildren();}
    finally{loading=false;el('history-refresh').disabled=false;}
  }
  for(const view of ['products','history'])el('view-'+view).addEventListener('click',()=>{el('products-view').hidden=view!=='products';el('history-view').hidden=view!=='history';for(const key of ['products','history'])el('view-'+key).setAttribute('aria-pressed',String(key===view));el('market-label').textContent=view==='history'?'All catalogs':el('market-hint').textContent;if(view==='history')load();});
  el('history-refresh').addEventListener('click',load);
});
