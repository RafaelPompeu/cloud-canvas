// Keep the original SVG bytes in each image so exports are self-contained.
export async function loadOfficialIcons(catalog, fetchAsset=fetch) {
  const assets=new Map();
  for(const item of catalog){
    if(!item.iconAsset||assets.has(item.iconAsset))continue;
    if(!/^\/static\/icons\/[a-z0-9-]+\/[a-z0-9-]+\.svg$/.test(item.iconAsset))throw new Error('Caminho de ícone inválido.');
    assets.set(item.iconAsset,(async()=>{
      const response=await fetchAsset(item.iconAsset);
      if(!response.ok)throw new Error(`Não foi possível carregar o ícone de ${item.name}.`);
      const bytes=new Uint8Array(await response.arrayBuffer());
      let binary='';
      for(const byte of bytes)binary+=String.fromCharCode(byte);
      return 'data:image/svg+xml;base64,'+btoa(binary);
    })());
  }
  return new Map(await Promise.all([...assets].map(async([path,asset])=>[path,await asset])));
}
