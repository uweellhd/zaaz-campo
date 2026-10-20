export function periodoRecente(now=new Date(),days=30){
 const format=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}),fim=format.format(now),start=new Date(fim+'T12:00:00-03:00');start.setUTCDate(start.getUTCDate()-(days-1));return {inicio:format.format(start),fim};
}
export function limitarAberturaIncidentes(base,filters,s){
 // Conclusões antigas não têm timestamp próprio. Nesse modo o histórico é preservado.
 if(filters.baseData==='conclusao')return base;
 const parts=[];if(filters.inicio)parts.push(s.where('dataTimestamp','>=',Date.parse(filters.inicio+'T00:00:00-03:00')));
 if(filters.fim){const end=new Date(filters.fim+'T00:00:00-03:00');end.setUTCDate(end.getUTCDate()+1);parts.push(s.where('dataTimestamp','<',end.getTime()))}
 return parts.length?s.query(base,...parts):base;
}
