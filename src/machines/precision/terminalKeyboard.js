export function drawTerminalKeyboard(g,W,H){
  g.fillStyle='#272b2e';g.fillRect(0,0,W,H);g.font='19px sans-serif';g.textAlign='center';g.textBaseline='middle';
  ['ESC F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12','1 2 3 4 5 6 7 8 9 0 - = DEL','Q W E R T Y U I O P [ ]','A S D F G H J K L ; ENTER','Z X C V B N M , . / SHIFT','CTRL ALT SPACE ALT CTRL ← ↓ →'].forEach((row,r)=>{const names=row.split(' '),w=(W-24)/names.length;names.forEach((name,i)=>{const x=12+i*w,y=8+r*67;g.fillStyle='#484d50';g.fillRect(x,y,w-5,59);g.fillStyle='#202426';g.fillRect(x+2,y+2,w-9,53);g.fillStyle='#ccd0d2';g.fillText(name,x+(w-5)/2,y+29);});});g.textAlign='left';g.textBaseline='alphabetic';
}
