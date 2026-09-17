/* Minimal XLSX writer: inline strings (no formulas), numeric cells, UTF-8 ZIP. */
(function (root) {
  const enc = new TextEncoder();
  const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const crcTable = Array.from({length:256}, (_,i) => {for(let n=0;n<8;n++) i=(i&1)?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
  function crc(bytes) {let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
  function header(size, fields) {const bytes=new Uint8Array(size),v=new DataView(bytes.buffer);for(const [offset,value,width] of fields)width===4?v.setUint32(offset,value,true):v.setUint16(offset,value,true);return bytes;}
  function zip(files) {
    const parts=[],central=[];let offset=0,centralSize=0;
    for(const [name,text] of Object.entries(files)) {
      const filename=enc.encode(name),data=enc.encode(text),sum=crc(data);
      const local=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[12,33,2],[14,sum,4],[18,data.length,4],[22,data.length,4],[26,filename.length,2]]);
      const directory=header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[14,33,2],[16,sum,4],[20,data.length,4],[24,data.length,4],[28,filename.length,2],[42,offset,4]]);
      parts.push(local,filename,data);central.push(directory,filename);offset+=local.length+filename.length+data.length;centralSize+=directory.length+filename.length;
    }
    const count=Object.keys(files).length;
    return new Blob([...parts,...central,header(22,[[0,0x06054b50,4],[8,count,2],[10,count,2],[12,centralSize,4],[16,offset,4]])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  const columns=[['id','ID'],['name','Name'],['subtitle','Description'],['price','Current price'],['original_price','Original price'],['discount','Discount %'],['currency','Currency'],['category','Category'],['sport','Sport'],['division','Division'],['sizes','Listed sizes'],['color_variants','Listed variants'],['rating','Rating'],['reviews','Reviews'],['orderable','Orderable'],['url','Link']];
  function workbook(state) {
    if(!state.complete || state.products.length!==state.total || new Set(state.products.map(p=>p.id)).size!==state.total) throw new Error('Excel export requires a complete list without duplicates.');
    if(state.products.some(p=>p.currency!==state.currency))throw new Error('Mixed currencies cannot be exported.');
    const rows=[['PLP',state.url],['Checked at (UTC)',state.fetched_at],['Unique products',state.total],[],columns.map(([key,name])=>name+(['price','original_price'].includes(key)?' '+state.currency:'')),...state.products.map(p=>columns.map(([key])=>p[key]))];
    const sheet=rows.map((row,index)=>'<row r="'+(index+1)+'">'+row.map((value,col)=>{
      const ref=String.fromCharCode(65+col)+(index+1);
      return typeof value==='number' && Number.isFinite(value)?`<c r="${ref}"><v>${value}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    }).join('')+'</row>').join('');
    const prefix='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    return zip({
      '[Content_Types].xml':prefix+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      '_rels/.rels':prefix+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml':prefix+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels':prefix+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/worksheets/sheet1.xml':prefix+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="5" topLeftCell="C6" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="16" width="22" customWidth="1"/></cols><sheetData>${sheet}</sheetData><autoFilter ref="A5:P${rows.length}"/></worksheet>`
    });
  }
  root.catalogWorkbook=workbook;
})(globalThis);
