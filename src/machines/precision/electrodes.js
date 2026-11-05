export const ELECTRODE_KEY='rmt-edm-electrodes-v1';
export const defaultElectrodes=()=>[
  {id:'copper-prism-20-15',name:'Cu · 20 × 15 mm',shape:'box',w:20,d:15,length:100},
  {id:'copper-round-20',name:'Cu · Ø20 mm',shape:'round',w:20,d:20,length:100},
];
export function parseElectrodes(json){
  const data=typeof json==='string'?JSON.parse(json):json;
  if(!data||data.version!==1||!Array.isArray(data.electrodes)||data.electrodes.length>200)throw new Error('Neplatná knižnica elektród / Invalid electrode library.');
  const ids=new Set();
  return data.electrodes.map(e=>{
    if(!e||typeof e.id!=='string'||!e.id||ids.has(e.id)||typeof e.name!=='string'||!e.name.trim()||!['box','round'].includes(e.shape)||!Number.isFinite(e.w)||e.w<2||e.w>40||!Number.isFinite(e.d)||e.d<2||e.d>40||!Number.isFinite(e.length)||e.length<80||e.length>180)throw new Error('Skontroluj názov, rozmery a jedinečné ID elektródy / Check name, dimensions and unique electrode ID.');
    ids.add(e.id);return {id:e.id,name:e.name.trim().slice(0,80),shape:e.shape,w:e.w,d:e.d,length:e.length};
  });
}
export function readElectrodes(storage){const saved=storage.getItem(ELECTRODE_KEY);return saved?parseElectrodes(saved):defaultElectrodes();}
export function writeElectrodes(storage,electrodes){const data={version:1,electrodes};parseElectrodes(data);storage.setItem(ELECTRODE_KEY,JSON.stringify(data));}
