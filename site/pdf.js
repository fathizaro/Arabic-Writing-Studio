const pdfEncoder = new TextEncoder();

function makePdf(images) {
  const parts = [];
  const offsets = [0];
  let length = 0;
  function append(data) {
    const bytes = typeof data === 'string' ? pdfEncoder.encode(data) : data;
    parts.push(bytes);
    length += bytes.length;
  }
  function object(id, body) {
    offsets[id] = length;
    append(id+' 0 obj\n');
    for (const part of body) append(part);
    append('\nendobj\n');
  }
  append('%PDF-1.4\n');
  object(1,['<< /Type /Catalog /Pages 2 0 R >>']);
  const kids = images.map((_,i)=>(3+i*3)+' 0 R').join(' ');
  object(2,['<< /Type /Pages /Count '+images.length+' /Kids ['+kids+'] >>']);
  images.forEach(({bytes,width,height},i) => {
    const n=3+i*3;
    object(n,['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /PageImage '+(n+2)+' 0 R >> >> /Contents '+(n+1)+' 0 R >>']);
    const paint='q\n595 0 0 842 0 0 cm\n/PageImage Do\nQ\n';
    object(n+1,['<< /Length '+paint.length+' >>\nstream\n',paint,'endstream']);
    object(n+2,['<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+bytes.length+' >>\nstream\n',bytes,'\nendstream']);
  });
  const start=length;
  append('xref\n0 '+offsets.length+'\n0000000000 65535 f \n');
  for (const offset of offsets.slice(1)) append(String(offset).padStart(10,'0')+' 00000 n \n');
  append('trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n');
  return new Blob(parts,{type:'application/pdf'});
}

function drawHomeworkPage(page, board, item, i, snapshot) {
  const ctx = page.getContext('2d');
  function text(value,x,y,{size=25,rtl=false,bold=false,max=1030}={}) {
    ctx.fillStyle='#142d30';
    ctx.font=(bold?'bold ':'')+size+'px Naskh, sans-serif';
    ctx.direction=rtl?'rtl':'ltr';
    ctx.textAlign=rtl?'right':'left';
    ctx.fillText(value,x,y,max);
  }
  ctx.fillStyle='white';
  ctx.fillRect(0,0,page.width,page.height);
  text('Arabic Writing Studio • Homework',52,78,{size:31,bold:true});
  text('Student',52,137,{bold:true});
  text(snapshot.name.trim() || '________________',162,137,{max:690});
  text(snapshot.date || '__________',905,137,{max:228});
  text(item.english,52,238,{size:47,bold:true});
  text(item.letter+'  '+item.name,1138,238,{size:74,rtl:true});
  positions.forEach((position,j)=>{
    const y=266+j*328;
    ctx.fillStyle='#e8f3f1';
    ctx.fillRect(52,y,1086,50);
    text(position,67,y+35,{bold:true});
    text(arabicPositions[j],1120,y+35,{rtl:true,size:27});
    [true,false].forEach((word,k)=>{
      const x=52+k*553;
      const model=word ? item.words[j][0] : item.forms[j];
      text(word ? 'Word • '+item.words[j][1] : 'Letter form',x,y+91,{max:380});
      text(model,x+533,y+94,{rtl:true,size:46});
      drawBoard(board,snapshot.ink[i+'-'+(j*2+Number(word))]||[],model,false,word);
      ctx.drawImage(board,x,y+104,533,213.2);
      ctx.strokeStyle='#9fb9b7';
      ctx.lineWidth=2;
      ctx.strokeRect(x,y+104,533,213.2);
    });
  });
  text('Letter '+(i+1)+' of '+letters.length,52,1637);
}

async function downloadHomework(snapshot) {
  await document.fonts.ready;
  const page=Object.assign(document.createElement('canvas'),{width:1190,height:1684});
  const board=Object.assign(document.createElement('canvas'),{width:1000,height:400});
  const images=[];
  for (const [i,item] of letters.entries()) {
    drawHomeworkPage(page,board,item,i,snapshot);
    const jpeg=page.toDataURL('image/jpeg',.89).split(',')[1];
    const bytes=Uint8Array.from(atob(jpeg), character=>character.charCodeAt(0));
    images.push({bytes,width:page.width,height:page.height});
  }
  const url=URL.createObjectURL(makePdf(images));
  const link=document.createElement('a');
  const name=snapshot.name.trim().replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,55);
  link.href=url;
  link.download='Arabic-Handwriting'+(name?'-'+name:'')+'.pdf';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
