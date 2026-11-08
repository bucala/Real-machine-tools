import{C as e}from"./index-CBdg2dVo.js";var t=(e,t,n,r=24)=>{let i=e(t);for(let a=0;a<r;a++){let r=(t+n)/2,a=e(r);Math.sign(a)===Math.sign(i)?(t=r,i=a):n=r}return(t+n)/2};function n(e,n,r,i){let a=n[0]+r,o=n[1]+i,s=e.max[2]+1,c=e.min[2],l=e.res/2,u=t=>e.sdfAt([a,o,t]);for(let e=s;e>c;e-=l)if(u(e-l)>0)return t(u,e,e-l)-n[2];return null}function r(e,n,r,i,a,o,s,c=80){let l=e=>[n[0]+r+o*e,n[1]+i+s*e,n[2]+a],u=e.res/2,d=t=>e.sdfAt(l(t));if(d(0)>0)return 0;for(let e=0;e<c;e+=u)if(d(e+u)>0)return t(d,e,e+u);return null}function i(e,t,n,i,a){let o=(o,s)=>r(e,t,n,i,a,o,s),s=o(-1,0),c=o(1,0),l=o(0,-1),u=o(0,1);return{x:s!=null&&c!=null?s+c:null,y:l!=null&&u!=null?l+u:null}}var a={id:`rxu1001`,brand:`Röders`,name:`RXU 1001 DSH`,controller:`RMS6 · ISO training interface`,K:1,table:600,mag:24,hA:101,X:[-400,400],Y:[-450,405],nose:[76,576],A:[-115,115],rapid:6e4,rapidZ:6e4,vA:90,vC:180,smax:24e3,mmax:67,pmax:1/0,tc:6,tcY:350,maxToolDiameter:35,maxToolLength:250,weight:21e3,maxWorkpiece:800,envelope:[3500,5300,3550],source:`Röders catalogue, supplied PDF pp. 58–59; Ø600 round table variant`};function o(t){if(t.d>a.maxToolDiameter)throw Error(e(`RXU 1001 DSH · štandardné vreteno: nástroj max. Ø35 mm.`,`RXU 1001 DSH · standard spindle: tool max. Ø35 mm.`));if(t.l>a.maxToolLength)throw Error(e(`Výukový profil RXU: dĺžka nástroja max. 250 mm.`,`RXU training profile: tool length max. 250 mm.`))}var s=`%
O1001 (ROEDERS - ISO TRAINING POST)
(T3 D=10. CR=0. - flat end mill)
G21 G90 G17 G40 G49 G80
T3 M6
S16000 M3
G54 G43 H3
G0 X0 Y0 Z20
M8
G0 Z2
G1 Z-2 F180
G1 X10 F900
G2 X10 Y0 I-10 J0
G1 X0
G0 Z20
M5 M9
G53 G0 Z0
M30
%`,c={id:`ex500`,brand:`OSCARMAX`,name:`EX 500`,X:[-250,250],Y:[-200,200],Z:450,table:[850,450],workpiece:[1020,710],tankHeight:355,chuck:[130,480],maxWorkpiece:2300,maxElectrode:200,weight:3e3,current:60,powerKva:10,tankLitres:850,filterMicrons:20,filters:6,envelope:[2493,2810.5,2778],structure:`column-moving`,source:`https://www.oscaredm.com/en-US/p182-die-sinker-electrical-discharge-machine-ex-500`};export{i as a,o as i,a as n,n as o,s as r,c as t};