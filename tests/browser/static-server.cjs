const http=require('http'),fs=require('fs'),path=require('path');
function createStaticServer(root,{pages=false}={}) {
  root=path.resolve(root);
  const headerBlocks=fs.readFileSync(path.join(root,'_headers'),'utf8').trim().split(/\n\s*\n/).map(block=>block.split('\n'));
  const matches=(pattern,url)=>pattern==='/*'||pattern===url||(pattern==='/*.html'&&url.endsWith('.html'))||(pattern.endsWith('/*')&&url.startsWith(pattern.slice(0,-1)));
  return http.createServer((req,res)=>{
    let url;try{url=decodeURIComponent(req.url.split('?')[0])}catch{res.writeHead(400);res.end();return}
    for(const [pattern,...lines]of headerBlocks)if(matches(pattern,url))for(const line of lines){const colon=line.indexOf(':');if(colon>0)res.setHeader(line.slice(0,colon).trim(),line.slice(colon+1).trim())}
    let relative=url==='/'?'index.html':url.slice(1),file=path.resolve(root,relative);
    const permitted=file.startsWith(root+path.sep);
    if(!permitted){res.writeHead(404);res.end();return}
    if(pages&&url.endsWith('.html')&&fs.existsSync(file)){
      res.writeHead(308,{Location:(url==='/index.html'?'/':url.slice(0,-5))+(req.url.includes('?')?'?'+req.url.split('?').slice(1).join('?'):'')});res.end();return;
    }
    if(pages&&url!=='/'&&!path.extname(file)&&fs.existsSync(file+'.html'))file+='.html';
    fs.readFile(file,(error,data)=>{
      if(error){res.statusCode=404;res.setHeader('Content-Type','text/html; charset=UTF-8');res.end(fs.readFileSync(path.join(root,'404.html')));return}
      const ext=path.extname(file),type={'.html':'text/html','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.ttf':'font/ttf'}[ext]||'application/octet-stream';
      res.setHeader('Content-Type',type);res.end(data);
    });
  });
}
module.exports={createStaticServer};
