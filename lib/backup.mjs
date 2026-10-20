// Formato portátil e cifrado. Não inclui autenticação, contas, equipes ou fotos.
export const BACKUP_PROJECT='nextflow-telecom';
export const MAX_BACKUP_BYTES=30*1024*1024;
export const MAX_BACKUP_DOCS=20000;
const bytes=new TextEncoder(),text=new TextDecoder();
const b64=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s)};
const unb64=s=>{if(typeof s!=='string'||s.length>MAX_BACKUP_BYTES*2||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw Error('Arquivo inválido.');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))};
export function pack(v){
 if(v===null||['string','number','boolean'].includes(typeof v))return {t:'value',v};
 if(v?.toDate&&Number.isInteger(v.seconds))return {t:'timestamp',s:v.seconds,n:v.nanoseconds};
 if(v instanceof Date)return {t:'timestamp',s:Math.floor(v.getTime()/1000),n:(v.getTime()%1000)*1000000};
 if(Array.isArray(v))return {t:'array',v:v.map(pack)};
 if(v&&typeof v==='object')return {t:'map',v:Object.fromEntries(Object.entries(v).filter(([k])=>!['fotos','dadosBase64'].includes(k)).map(([k,val])=>[k,pack(val)]))};
 throw Error('Tipo de dado não suportado na cópia.');
}
export function unpack(v,timestamp,depth=0){
 if(depth>50||!v||typeof v!=='object')throw Error('Dados inválidos.');
 if(v.t==='value'&&(v.v===null||['string','boolean'].includes(typeof v.v)||typeof v.v==='number'&&Number.isFinite(v.v)))return v.v;
 if(v.t==='timestamp'&&Number.isInteger(v.s)&&Number.isInteger(v.n)&&v.n>=0&&v.n<1e9)return timestamp(v.s,v.n);
 if(v.t==='array'&&Array.isArray(v.v))return v.v.map(x=>unpack(x,timestamp,depth+1));
 if(v.t==='map'&&v.v&&Object.keys(v.v).some(k=>['fotos','dadosBase64'].includes(k)))throw Error('Fotos não são permitidas na cópia de histórico.');
 if(v.t==='map'&&v.v&&typeof v.v==='object'&&!Array.isArray(v.v))return Object.fromEntries(Object.entries(v.v).map(([k,x])=>[k,unpack(x,timestamp,depth+1)]));
 throw Error('Tipo de dado inválido.');
}
export function backupPath(path){
 const p=String(path).split('/');if(p.length===2)return ['incidentes','medicoes','projetosEvidencias'].includes(p[0])&&!!p[1];
 return p[0]==='medicoes'&&!!p[1]&&(p.length===4&&['arquivos','comprovantes'].includes(p[2])&&!!p[3]||p.length===6&&p[2]==='arquivos'&&!!p[3]&&p[4]==='partes'&&!!p[5]);
}
export function validateBackup(payload){
 if(payload?.format!=='nextflow-operacao-v1'||payload.project!==BACKUP_PROJECT||!Array.isArray(payload.documents)||payload.documents.length>MAX_BACKUP_DOCS)throw Error('Formato ou projeto da cópia inválido.');
 const paths=new Set();for(const d of payload.documents){if(!backupPath(d.path)||paths.has(d.path))throw Error('Cópia contém caminho não permitido ou repetido.');paths.add(d.path);unpack(d.data,(s,n)=>({seconds:s,nanoseconds:n}));}
 for(const d of payload.documents)if(d.path.split('/').length>2&&!paths.has(d.path.split('/').slice(0,-2).join('/')))throw Error('Cópia com arquivo sem seu registro pai.');
 return payload;
}
async function key(password,salt,usages){
 if(typeof password!=='string'||password.length<12||password.length>256)throw Error('Use uma senha de 12 a 256 caracteres para a cópia.');
 const material=await crypto.subtle.importKey('raw',bytes.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,usages);
}
export async function encryptBackup(payload,password){
 validateBackup(payload);await verifyBackupFiles(payload);const clear=bytes.encode(JSON.stringify(payload));if(clear.length>MAX_BACKUP_BYTES)throw Error('Cópia maior que 30 MiB. Exporte um período menor.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),k=await key(password,salt,['encrypt']);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,clear);
 return JSON.stringify({format:'nextflow-encrypted-v1',kdf:'PBKDF2-SHA256-600000',cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),data:b64(new Uint8Array(encrypted))});
}
export async function decryptBackup(envelope,password){
 if(typeof envelope!=='string'||envelope.length>MAX_BACKUP_BYTES*1.5)throw Error('Arquivo muito grande ou inválido.');
 const e=JSON.parse(envelope);if(e.format!=='nextflow-encrypted-v1'||e.kdf!=='PBKDF2-SHA256-600000'||e.cipher!=='AES-256-GCM')throw Error('Formato de criptografia inválido.');
 const salt=unb64(e.salt),iv=unb64(e.iv);if(salt.length!==16||iv.length!==12)throw Error('Arquivo inválido.');
 try{const k=await key(password,salt,['decrypt']),clear=await crypto.subtle.decrypt({name:'AES-GCM',iv},k,unb64(e.data));const result=validateBackup(JSON.parse(text.decode(clear)));await verifyBackupFiles(result);return result}catch{throw Error('Não foi possível abrir a cópia. Confira a senha e a integridade do arquivo.');}
}
export async function verifyBackupFiles(payload){
 const byPath=new Map(payload.documents.map(d=>[d.path,unpack(d.data,(s,n)=>({seconds:s,nanoseconds:n}))]));
 for(const [path,record]of byPath)if(/^medicoes\/[^/]+$/.test(path)){
  for(const side of ['tx','rx']){
   const count=record[side+'Arquivos']||0;if(!Number.isInteger(count)||count<0||count>3)throw Error('Contagem de arquivos inválida.');
   for(let n=0;n<count;n++){
    const fp=`${path}/arquivos/${side}-${n}`,f=byPath.get(fp);
    if(!f?.completo||!Number.isInteger(f.tamanho)||f.tamanho<1||f.tamanho>2097152||!Number.isInteger(f.partes)||f.partes<1||f.partes>4||f.lado!==side||f.indice!==n)throw Error('Arquivo entregue ausente ou inválido na cópia.');
    const result=new Uint8Array(f.tamanho);let offset=0;
    for(let i=0;i<f.partes;i++){const part=byPath.get(fp+'/partes/'+i);if(!part||typeof part.dados!=='string')throw Error('Parte de arquivo ausente.');const data=unb64(part.dados);if(offset+data.length>result.length)throw Error('Tamanho de arquivo inválido.');result.set(data,offset);offset+=data.length;}
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',result))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(offset!==f.tamanho||hash!==f.sha256)throw Error('A integridade de um arquivo OTDR não foi confirmada.');
   }
  }
 }
}
