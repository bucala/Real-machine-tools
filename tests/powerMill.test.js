import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { detectNcTools } from '../src/machines/cnc/toolLibrary';
import { POWERMILL_URL, getPowerMillToken, powerMillRequest, powerMillToolsToNc, setPowerMillToken } from '../src/machines/cnc/powerMill';
const token='test_token_only_12345678901234567890';
describe('PowerMill loopback connection',()=>{
  it('uses an authenticated fixed localhost API; keeps secrets out of URL and storage',async()=>{
    let actual;
    setPowerMillToken(token);expect(getPowerMillToken()).toBe(token);
    const reply=await powerMillRequest('status',{fetcher:async(url,options)=>{actual={url,options};return {ok:true,json:async()=>({bridge:'rmt-powermill',version:1,connected:true})};}});
    expect(reply.connected).toBe(true);expect(actual.url).toBe(`${POWERMILL_URL}/v1/status`);
    expect(actual.url).not.toContain(token);expect(actual.options.headers.Authorization).toBe(`Bearer ${token}`);expect(actual.options.credentials).toBe('omit');
    await expect(powerMillRequest('execute',{token})).rejects.toThrow('Unsupported');
    await expect(powerMillRequest('status',{token:'bad'})).rejects.toThrow('token');
    setPowerMillToken('');
  });
  it('reports auth, network, cancellation and incompatible API errors without automatic retries',async()=>{
    const fetcher=async()=>({ok:false,json:async()=>({error:'Invalid pairing token'})});
    await expect(powerMillRequest('status',{token,fetcher})).rejects.toThrow('Invalid pairing token');
    await expect(powerMillRequest('status',{token,fetcher:async()=>{throw new TypeError('network');}})).rejects.toThrow('Windows');
    await expect(powerMillRequest('status',{token,fetcher:async()=>({ok:true,json:async()=>({version:2})})})).rejects.toThrow('Incompatible');
    await expect(powerMillRequest('tools',{token,body:{tool:{}},fetcher:async()=>{throw Object.assign(new Error(),{name:'AbortError'});}})).rejects.toThrow('retrying');
  });
  it('stages live tools for review and never guesses gauge length or holder geometry',()=>{
    const nc=powerMillToolsToNc({units:'mm',tools:[{t:3,name:'Mill 10 (live)',shape:'flat',d:10,cr:0,lc:25,s:48,z:3}]});
    const [row]=detectNcTools(nc);expect(row.fields).toMatchObject({d:10,lc:25,s:48,z:3});expect(row.missing).toEqual(['l','dh']);
    expect(()=>powerMillToolsToNc({units:'inch',tools:[]})).toThrow();
    expect(()=>powerMillToolsToNc({units:'mm',tools:[{t:3,d:NaN}]})).toThrow();
  });
  it('verifies Windows bridge HTTP, COM mapping and local-file boundaries with a fake COM adapter',()=>{
    expect(()=>execFileSync('python3',['-m','unittest','discover','-s','integrations/powermill','-p','test_bridge.py'],{timeout:15000,stdio:'pipe'})).not.toThrow();
  });
});
