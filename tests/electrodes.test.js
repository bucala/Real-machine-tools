import { it,expect } from 'vitest';
import { defaultElectrodes,parseElectrodes,readElectrodes,writeElectrodes } from '../src/machines/precision/electrodes';
it('round-trips the electrode cabinet and rejects corrupt imports without overwriting saved data',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},tools=defaultElectrodes();
  writeElectrodes(storage,tools);expect(readElectrodes(storage)).toEqual(tools);
  for(const e of [{...tools[0],w:NaN},{...tools[0],length:0}])expect(()=>writeElectrodes(storage,[e])).toThrow();
  expect(readElectrodes(storage)).toEqual(tools);
  expect(()=>parseElectrodes({version:1,electrodes:[tools[0],tools[0]]})).toThrow();
});
