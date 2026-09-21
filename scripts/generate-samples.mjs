import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const output = new URL('../public/samples/', import.meta.url);
await mkdir(output, { recursive: true });
const text = (x,y,value,size=18,color='#354052',weight=400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${value}</text>`;
const rect = (x,y,w,h,fill='#fff',stroke='none',radius=8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
const pill = (x,y,label,color='#e7edf5',ink='#526274',w=100) => rect(x,y,w,32,color)+text(x+12,y+22,label,14,ink,600);
const button = (x,y,w,label,primary=false) => rect(x,y,w,42,primary?'#17634d':'#f0f3f7',primary?'none':'#d8e0e9')+text(x+16,y+27,label,15,primary?'#fff':'#536277',600);
const base = (title,sub,body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="820"><style>text{font-family:'Malgun Gothic','Noto Sans CJK KR',sans-serif}</style>${rect(0,0,1200,820,'#f3f5f8','none',0)}${rect(0,0,1200,72,'#172c3e','none',0)}${text(30,44,'FIELD / 업무 포털',23,'#fff',700)}${text(900,43,'합성 업무 화면 · 데모',15,'#c5d4df')}${rect(0,72,188,748,'#fff','none',0)}${text(26,123,'업무 관리',16,'#718096',600)}${rect(15,154,158,46,'#e8f2ef')}${text(30,183,'내 업무',17,'#17634d',700)}${text(30,243,'승인 요청',17)}${text(30,303,'현장 점검',17)}${text(30,363,'운영 현황',17)}${text(228,130,title,28,'#182b3c',700)}${text(228,164,sub,16,'#778494')}${body}${text(230,792,'이 화면의 현장명, 담당자, 수치와 업무는 모두 가상 데이터입니다.',12,'#8995a3')}</svg>`;
function approvals(fixed) {
 let b = rect(228,191,934,80);
 b += rect(250,211,420,42,'#fff','#d6dee7')+text(267,238,fixed?'요청명 또는 담당자 검색':'검색',15,'#8893a2');
 b += button(690,211,110,'검색',fixed);
 b += text(228,312,fixed?'검토할 요청 5건 · 기한 초과 2건':'조회 결과',20,'#26374a',600);
 b += rect(228,334,934,357);
 b += rect(228,334,934,47,'#e9edf2');
 ['요청명','담당자',fixed?'처리 기한':'일자','상태',fixed?'검토':'작업'].forEach((v,i)=>b+=text([250,597,732,926,1054][i],364,v,15,'#5b6d7e',600));
 const names=['가상 A현장 자재 반입 계획','가상 B현장 점검 결과 확인','가상 C현장 작업 승인 요청','가상 A현장 장비 사용 요청','가상 B현장 일정 변경 요청'];
 const dates=['09.19','09.20','09.21','09.23','09.24'];
 names.forEach((n,i)=>{ const y=419+i*59; b+=`<path d="M228 ${y+20} H1162" stroke="#edf0f4"/>`; b+=text(250,y,n,16)+text(597,y,['담당 A','담당 B','담당 C','담당 D','담당 E'][i],16); b+=text(732,y,dates[i]+(fixed&&i<2?' · 기한 초과':''),fixed?14:16,fixed&&i<2?'#b53637':'#5c6c7d'); b+=fixed?pill(910,y-22,i<2?'검토 대기':'접수','#fff1d9','#915e11',108):`<circle cx="966" cy="${y-6}" r="7" fill="${i%2?'#65ae91':'#e5a345'}"/>`; b+=button(1042,y-27,104,fixed?'검토하기':'확인',false); });
 if(fixed)b+=text(230,736,'기한이 지난 요청부터 검토하세요. 상태와 기한은 서로 다른 기준입니다.',15,'#506477');
 return base('승인 요청',fixed?'담당 요청을 검토하고 다음 처리 단계를 진행하세요.':'업무 처리 시스템',b);
}
function inspections(fixed) {
 let b=rect(228,192,934,549);
 if(!fixed)b+=rect(256,214,878,46,'#fff0ef')+text(275,244,'입력값을 확인해주세요.',16,'#bd4345');
 const labels=['점검 장소','점검 일자','점검 항목','측정값'];
 const hints=fixed?['가상 A현장 / 2층 작업구역','2026-09-21','안전 난간 높이','예: 120 (cm)']:['장소 입력','날짜','항목','값'];
 for(let i=0;i<4;i++){const col=i%2,row=Math.floor(i/2),x=260+col*446,y=(fixed?272:300)+row*142; if(fixed)b+=text(x,y-19,labels[i]+' *',16,'#33465b',600); b+=rect(x,y,398,49,'#fff',fixed&&i===3?'#c64949':'#d8dfe8');b+=text(x+15,y+31,hints[i],16,'#7e8a99'); if(fixed&&i===3)b+=text(x,y+75,'측정값을 cm 단위의 숫자로 입력해 주세요.',13,'#b73439');}
 if(fixed)b+=text(260,226,'* 필수 입력 · 저장 전에 입력 내용을 확인해 주세요.',14,'#718091');
 b+=text(260,609,fixed?'추가 메모 (선택)':'내용',16,'#536374')+rect(260,626,844,63,'#fff','#d8dfe8');
 b+=button(796,755,142,fixed?'임시 저장':'초기화',!fixed)+button(950,755,188,fixed?'점검 결과 등록':'확인',fixed);
 return base('현장 점검 등록',fixed?'점검한 장소와 결과를 남겨 담당자에게 전달합니다.':'신규 등록',b);
}
function dashboard(fixed) {
 let b='';
 const vals=fixed?['128건','24건','91.6%']:['128','24','91.6'];
 ['이번 주 요청','미처리 요청','기한 내 처리율'].forEach((v,i)=>{b+=rect(228+i*316,199,302,134)+text(250+i*316,235,v,17,'#778393')+text(250+i*316,292,vals[i],38,'#20364c',700);});
 b+=rect(228,359,589,354)+text(252,401,fixed?'현장별 미처리 요청 (건)':'현황',20,'#32465b',600);
 for(let i=0;i<4;i++){const y=459+i*61;b+=text(252,y,fixed?'가상 '+['A','B','C','D'][i]+'현장':['C1','C2','C3','C4'][i],15)+rect(362,y-24,[324,172,88,218][i],30,['#e9a35e','#608da7','#76a98f','#ab91ba'][i]);if(fixed)b+=text(374+[324,172,88,218][i],y-2,[9,5,3,7][i]+'건',15);}
 b+=rect(836,359,326,354)+text(860,401,fixed?'오늘 우선 확인할 업무':'알림',20,'#32465b',600);
 if(fixed){b+=pill(857,431,'기한 초과','#fff0ed','#b24039',90)+text(860,493,'가상 A현장 승인 요청 4건',15)+text(860,529,'가상 D현장 승인 요청 2건',15)+button(858,637,279,'기한 초과 목록 보기',true);}else{b+=text(860,469,'A · 4',20)+text(860,525,'D · 2',20)+text(860,607,'자세히',15,'#9aa7b4');}
 if(fixed)b+=text(228,750,'기준: 2026.09.21 09:30 · 요청 범위: 이번 주 접수 건',14,'#69798c');
 return base('업무 현황',fixed?'주간 흐름과 오늘의 지연 위험을 함께 확인하세요.':'통합 모니터링',b);
}
for (const [id, render] of Object.entries({approval:approvals,inspection:inspections,dashboard})) {
 for (const fixed of [false,true]) {
  const file=new URL(`${id}-${fixed?'after':'before'}.png`,output);
  await writeFile(file,await sharp(Buffer.from(render(fixed))).png().toBuffer());
  console.log(file.pathname.split('/').at(-1));
 }
}
