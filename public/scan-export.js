// Draw the entire result from scan data; independent of viewport and table scrolling.
function scanImageData(results,columns,meta){
 const dates=[...new Set(results.filter(r=>r.ok).map(r=>r.date))];
 const number=n=>n==null?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
 return {title:'台股共振｜多檔掃描',subtitle:`基準日：${dates.join('、')||meta.asOf||'未取得'}　計算模式：${meta.modelLabel}`,summary:`已完成 ${results.length}/${meta.total} 檔・成功 ${results.filter(r=>r.ok).length}・失敗 ${results.filter(r=>!r.ok).length}`,headers:['股票名稱／代號','現價',...columns.map(c=>c[1])],rows:results.map(r=>{
 if(!r.ok)return {failed:true,cells:[String(r.query||''),String(r.error||'資料未取得')]};
 return {cells:[`${r.stock.name}\n${r.stock.code}・${r.date}`,number(r.current),...columns.map(([key])=>{const l=r.levels?.breakout&&key==='resistance1'?null:(r.levels||{support1:r.support,breakout:r.breakout})[key];return l?`${number(l.price)}${key.startsWith('support')&&l.distance<-.10?'〔中期〕':''}\n（${number(l.bandLow??l.price)}–${number(l.bandHigh??l.price)}）`:'尚未形成'})]};
 }),footer:`V3.3.44.20　產生時間：${meta.generatedAt}（台灣時間）｜價格帶完整保留；僅供研究與結構觀察。`,filename:`台股共振_多檔掃描_${dates.length===1?dates[0]:meta.asOf||'最新'}_${meta.fileStamp}.png`};
}
function scanImageLines(ctx,text,width){const lines=[];for(const part of String(text).split('\n')){let line='';for(const ch of part){if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line=''}line+=ch}lines.push(line)}return lines}
async function createScanImage(data){
 if(document.fonts?.ready)await document.fonts.ready;
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw new Error('此瀏覽器無法產生圖片');
 const widths=data.headers.map((_,i)=>i===0?260:i===1?150:240),padding=30,width=widths.reduce((a,b)=>a+b,0)+padding*2;
 ctx.font='22px sans-serif';const headers=data.headers.map((h,i)=>scanImageLines(ctx,h,widths[i]-24));const headerHeight=Math.max(60,...headers.map(l=>l.length*30+22));
 ctx.font='24px sans-serif';const rows=data.rows.map(row=>{const lines=row.cells.map((cell,i)=>scanImageLines(ctx,cell,(row.failed&&i===1?width-padding*2-widths[0]:widths[i])-24));return {...row,lines,height:Math.max(94,...lines.map(l=>l.length*34+24))}});
 const subtitle=scanImageLines(ctx,data.subtitle,width-60),footer=scanImageLines(ctx,data.footer,width-60),top=86+subtitle.length*32+56,height=top+headerHeight+rows.reduce((s,r)=>s+r.height,0)+footer.length*28+50,scale=1.5;
 canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);ctx.scale(scale,scale);ctx.fillStyle='#091321';ctx.fillRect(0,0,width,height);ctx.textBaseline='top';
 const draw=(lines,x,y,color,size,weight='normal')=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px sans-serif`;lines.forEach((line,i)=>ctx.fillText(line,x,y+i*(size+8)))};
 draw([data.title],padding,24,'#53dcf3',34,'bold');draw(subtitle,padding,78,'#c6d4e1',24);draw([data.summary],padding,top-44,'#c6d4e1',22);
 let y=top;ctx.fillStyle='#1a2e43';ctx.fillRect(padding,y,width-padding*2,headerHeight);let x=padding;headers.forEach((lines,i)=>{draw(lines,x+12,y+12,'#e0ebf5',22,'bold');x+=widths[i]});y+=headerHeight;
 rows.forEach((row,index)=>{ctx.fillStyle=index%2?'#102034':'#0d1b2d';ctx.fillRect(padding,y,width-padding*2,row.height);let x=padding;row.lines.forEach((lines,i)=>{draw(lines,x+12,y+14,row.failed?'#ffb2aa':i<2?'#e0ebf5':data.headers[i].includes('支撐')?'#7fe3c5':'#f7d483',i===0?22:24,i===0?'bold':'normal');x+=widths[i]});ctx.strokeStyle='#2b3b4e';ctx.beginPath();ctx.moveTo(padding,y+row.height);ctx.lineTo(width-padding,y+row.height);ctx.stroke();y+=row.height});
 draw(footer,padding,y+24,'#b0bdcb',20);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('圖片產生失敗，請重新試一次');return {blob,width:canvas.width,height:canvas.height};
}
