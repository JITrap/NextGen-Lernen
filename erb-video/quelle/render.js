const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const fs=require('fs');
const mode=process.argv[2]; // 'stills' t1,t2,... | 'full' worker N of M
(async()=>{
  const b=await chromium.launch({args:['--disable-gpu-vsync']});
  const p=await b.newPage({viewport:{width:1920,height:1080}});
  p.on('console',m=>console.log('PAGE',m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('http://localhost:8765/video.html');await p.evaluate(()=>window.ready);
  const grab=async t=>{const d=await p.evaluate(t=>{renderFrame(t);return document.getElementById('c').toDataURL('image/jpeg',0.93)},t);return Buffer.from(d.split(',')[1],'base64')};
  if(mode==='stills'){fs.mkdirSync('stills',{recursive:true});for(const t of process.argv[3].split(',').map(Number)){fs.writeFileSync(`stills/s_${t.toFixed(2)}.jpg`,await grab(t))}}
  else{const w=+process.argv[3],M=+process.argv[4];const N=98*30;fs.mkdirSync('frames',{recursive:true});
    for(let f=w;f<N;f+=M){fs.writeFileSync(`frames/f${String(f).padStart(5,'0')}.jpg`,await grab(f/30));if(f%300<M)console.log('w',w,'frame',f)}}
  await b.close();
})();
