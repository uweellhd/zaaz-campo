export function validarVolumePDF(rows) {
  if(rows.length>500)throw Error(`O recorte contém ${rows.length.toLocaleString('pt-BR')} registros. Para manter o PDF detalhado utilizável, filtre o período ou a equipe até 500 registros por arquivo. Nenhum registro foi omitido.`);
}
// Limite de concorrência também limita a pressão de leituras no Firestore.
export async function mapearComLimite(rows, work, concurrency=4) {
  const result=new Array(rows.length);let next=0,failure;
  async function run(){while(!failure){const i=next++;if(i>=rows.length)return;try{result[i]=await work(rows[i],i)}catch(error){failure=error;return}}}
  await Promise.all(Array.from({length:Math.min(Math.max(1,concurrency),rows.length)},run));
  if(failure)throw failure;return result;
}
