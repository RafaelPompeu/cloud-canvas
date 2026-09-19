const normalize=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function filterCatalog(catalog,provider='all',query=''){
  const terms=normalize(query).split(' ').filter(Boolean);
  return catalog.filter(item=>{
    if(provider!=='all'&&item.provider!==provider)return false;
    const text=normalize([item.name,item.type,item.subtitle,item.category,item.provider,item.provider==='shared'?'gerais':'',...(item.keywords||[])].join(' '));
    return terms.every(term=>text.includes(term));
  });
}
