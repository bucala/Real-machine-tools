import { describe, expect, it } from 'vitest';
import { defaultTools } from '../src/machines/cnc/tooling';
import { LIBRARY_KEY, decodeCsv, decodeLibrary, detectNcTools, encodeCsv, encodeLibrary, encodeToolComments, installTool, readCabinet, validateTool } from '../src/machines/cnc/toolLibrary';
const tools=()=>defaultTools().map((t,i)=>({id:`fixture-${i}`,...validateTool(t)}));

describe('Portable CNC tool cabinet',()=>{
  it('roundtrips geometry and identity through JSON and spreadsheet-safe CSV',()=>{
    const values=tools().map((t,i)=>({...t,name:[`Name, with "quotes"`, '=formula', '+plus', '-minus', '@at', "'=literal"][i%6]}));
    expect(decodeLibrary(encodeLibrary(values))).toEqual(values);
    expect(decodeCsv(encodeCsv(values))).toEqual(values);
    expect(encodeCsv(values)).toContain("'=formula");
    expect(decodeCsv(encodeCsv(values).replaceAll(',', ';'))).not.toEqual(values); // commas in quoted names stay literal, not separators
  });
  it('imports semicolon CSV and rejects unsupported versions, bad dimensions and partial CSV',()=>{
    const data=tools().slice(0,1);
    expect(decodeCsv(encodeCsv(data).replaceAll(',', ';'))).toEqual(data);
    expect(()=>decodeLibrary('{"format":"rmt-tool-library","version":2,"units":"mm","tools":[]}')).toThrow();
    expect(()=>decodeLibrary(encodeLibrary(data).replace('"units": "mm"','"units": "inch"'))).toThrow();
    for(const change of [{d:NaN},{d:81},{lc:100,s:40},{z:1000},{kind:'unknown'},{name:''},{l:null},{t:1.5},{kind:'cone',cr:.5}])expect(()=>validateTool({...data[0],...change})).toThrow();
    expect(()=>decodeCsv('t,name\n3,"unfinished')).toThrow();
    expect(()=>decodeCsv(encodeCsv(data)+'\npartial')).toThrow();
    expect(()=>encodeLibrary([data[0],data[0]])).toThrow(/Duplicate/);
  });
  it('persists a cabinet independently of the machine table and never overwrites a corrupt store on reading',()=>{
    const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
    const seeded=readCabinet(storage,defaultTools());
    expect(seeded).toHaveLength(10);expect(map.size).toBe(0);
    storage.setItem(LIBRARY_KEY,encodeLibrary(seeded));
    expect(readCabinet(storage,defaultTools())).toEqual(seeded);
    const original=tools(),next=installTool(original,seeded[2],12,36);
    expect(original).toHaveLength(10);expect(next.find(t=>t.t===12).d).toBe(10);
    expect(readCabinet(storage,defaultTools())).toEqual(seeded);
    expect(installTool(original,seeded[2],1,36)).toHaveLength(10);
    expect(()=>installTool(original,seeded[2],37,36)).toThrow();
    storage.setItem(LIBRARY_KEY,'broken');expect(()=>readCabinet(storage,defaultTools())).toThrow();expect(map.get(LIBRARY_KEY)).toBe('broken');
  });
});

describe('NC tool detection / PowerMill postprocessor exchange',()=>{
  it('reads every T reference, ignores offsets and keeps unknown dimensions unknown',()=>{
    const rows=detectNcTools('%\nT003 M6\nG43 H123 Z50\nG41 D25\nG81 X0 R10 Z-20\nT12\nM6\nT0 M6\nM30');
    expect(rows.map(r=>r.t)).toEqual([3,12]);
    expect(rows[0].fields).toEqual({});expect(rows[0].missing).toContain('d');expect(rows[0].missing).toContain('l');
  });
  it('reads multiline PowerMill-style metadata without inferring an ambiguous tool length',()=>{
    const [row]=detectNcTools('(TOOL NUMBER: 3)\n(TOOL NAME: flat end mill 10)\n(TOOL DIAMETER: 10)\n(CORNER RADIUS: 0)\n(TOOL LENGTH: 25)\n(GAUGE LENGTH: 115)\n(FLUTE LENGTH: 25)\n(STICK-OUT: 48)\n(HOLDER DIAMETER: 32)\n(FLUTES: 3)\nT3 M6');
    expect(row.fields).toMatchObject({d:10,cr:0,l:115,lc:25,s:48,dh:32,z:3,kind:'mill'});expect(row.missing).toEqual([]);
    expect(detectNcTools('(T2 D=16 TYPE=flat)\n(TOOL LENGTH: 40)')[0].missing).toContain('l');
  });
  it('roundtrips installed metadata exactly, including drill angles',()=>{
    const original=tools(),rows=detectNcTools(encodeToolComments(original));
    expect(rows).toHaveLength(10);
    rows.forEach((r,i)=>{expect(r.missing).toEqual([]);expect(r.conflicts).toEqual([]);expect(validateTool({...r.fields,t:r.t})).toEqual(validateTool(original[i]));});
  });
  it('detects conflicts and converts explicit inch dimensions while preserving angles and tooth counts',()=>{
    const [r]=detectNcTools('G20\n(T7 D=0.5 CR=0 TAPER=118 TYPE=drill Z=2)\n(T7 D=0.25)\nG21\n(T7 GAUGE LENGTH: 115)');
    expect(r.fields).toMatchObject({d:12.7,l:115,tip:118,z:2});expect(r.conflicts).toHaveLength(1);
    expect(detectNcTools('(T3 D=10 CR=2 TYPE=ball)')[0].conflicts).toHaveLength(1);
    expect(detectNcTools('BEGIN PGM A MM\nTOOL DEF 4 L+0 R+3\nTOOL CALL 4 Z S10000')[0]).toMatchObject({t:4,fields:{}});
  });
});
