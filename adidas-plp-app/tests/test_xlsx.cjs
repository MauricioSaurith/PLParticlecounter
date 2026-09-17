const assert=require('node:assert/strict');
const fs=require('node:fs');
require('../public/xlsx.js');
(async()=>{
 const products=Array.from({length:11516},(_,i)=>({id:'ID'+i,name:i===0?'=1+1':'Chaussures été & <test>',subtitle:'Description',price:99.95,original_price:120,discount:16.71,currency:'CAD',category:'Shoes',sport:'Running',division:'Performance',sizes:'7, 8',color_variants:2,rating:4.5,reviews:100,orderable:'Yes',url:'https://www.adidas.ca/fr/shoe/ID'+i+'.html'}));
 const state={complete:true,total:products.length,products,currency:'CAD',url:'https://www.adidas.ca/fr/search',fetched_at:'2026-09-17T12:00:00Z'};
 assert.throws(()=>catalogWorkbook({...state,complete:false}));
 assert.throws(()=>catalogWorkbook({...state,products:[...products.slice(1),products[1]]}));
 const blob=catalogWorkbook(state);assert(blob.size>4500000);
 if(process.argv[2])fs.writeFileSync(process.argv[2],Buffer.from(await blob.arrayBuffer()));
 console.log('11,516-row XLSX generated locally:',blob.size,'bytes; incomplete and duplicate exports rejected.');
})();
