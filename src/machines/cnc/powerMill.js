// Pairing secrets stay in JS memory, never in storage, URLs or cloud requests.
export const POWERMILL_URL = 'http://127.0.0.1:8766';
let sessionToken = '';
export const getPowerMillToken = () => sessionToken;
export const setPowerMillToken = token => { sessionToken = token; };

export async function powerMillRequest(path, { token = sessionToken, body, fetcher = globalThis.fetch, signal } = {}) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new Error('Vlož párovací token z okna mosta / Enter the bridge pairing token.');
  if (!['status','snapshot','nc','tools'].includes(path)) throw new Error('Unsupported PowerMill endpoint');
  const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),30000);
  const abort = ()=>controller.abort(); signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)controller.abort();
  try {
    const response = await fetcher(`${POWERMILL_URL}/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST', mode:'cors', credentials:'omit', cache:'no-store', redirect:'error', signal:controller.signal,
      headers:{ Authorization:`Bearer ${token}`, ...(body === undefined ? {} : {'Content-Type':'application/json'}) },
      ...(body === undefined ? {} : {body:JSON.stringify(body)}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error||`PowerMill bridge HTTP ${response.status}`);
    if(data.bridge !== 'rmt-powermill'||data.version !== 1)throw new Error('Nekompatibilný most / Incompatible PowerMill bridge.');
    return data;
  } catch(e) {
    if(e.name==='AbortError')throw new Error('Spojenie bolo prerušené alebo vypršalo. Pred opakovaním vytvorenia nástroja skontroluj PowerMill / Connection aborted or timed out; check PowerMill before retrying creation.');
    if(e instanceof TypeError)throw new Error('Most nie je dostupný. Spusti ho vo Windows a povoľ prehliadaču prístup k lokálnej sieti / Start the Windows bridge and allow browser local-network access.');
    throw e;
  } finally { clearTimeout(timer);signal?.removeEventListener('abort',abort); }
}

export function powerMillToolsToNc(snapshot) {
  if(snapshot.units!=='mm'||!Array.isArray(snapshot.tools)||snapshot.tools.length>500)throw new Error('Neplatné údaje PowerMill / Invalid PowerMill snapshot.');
  return ['G21', '(POWERMILL LIVE TOOL SNAPSHOT - VERIFY GAUGE LENGTH AND HOLDER)', ...snapshot.tools.map(t=>{
    if(!Number.isInteger(t.t)||t.t<1||t.t>9999)throw new Error('Neplatné číslo T / Invalid T number.');
    const values=Object.entries({d:'D',cr:'CR',lc:'LC',s:'S',z:'Z',tip:'TIP'}).flatMap(([key,alias])=>{
      if(t[key] === undefined)return [];
      if(typeof t[key]!=='number'||!Number.isFinite(t[key])||t[key]<0)throw new Error('Neplatný rozmer / Invalid PowerMill dimension.');
      return [`${alias}=${t[key]}`];
    });
    if(['flat','ball','bull','drill','chamfer'].includes(t.shape))values.push(`TYPE=${t.shape}`);
    return `(T${t.t} ${values.join(' ')} NAME=${String(t.name||`T${t.t}`).replace(/[\r\n();]/g,' ').slice(0,160)})`;
  })].join('\n');
}
