export const ZODIAC=[
 ['aries','Aries',1],['taurus','Taurus',2],['gemini','Gemini',3],['cancer','Cancer',4],['leo','Leo',5],['virgo','Virgo',6],['libra','Libra',7],['scorpio','Scorpio',8],['sagittarius','Sagittarius',9],['capricorn','Capricorn',10],['aquarius','Aquarius',11],['pisces','Pisces',12]
];
export const zodiacCollection=p=>ZODIAC.map(([id,label,rounds])=>({id,label,unlocked:p.rounds>=rounds,requirement:'Complete '+rounds+' game'+(rounds===1?'':'s'),group:'zodiac'}));
export const accessories=p=>[{id:'none',label:'None',unlocked:true},{id:'scarf',label:'Scarf',unlocked:p.rounds>=1},{id:'glasses',label:'Glasses',unlocked:p.points>=100},{id:'crown',label:'Crown',unlocked:p.tournamentWins>=1}];
export const month=t=>new Date(t).toISOString().slice(0,7);
export function seasonView(p,t){const key=month(t),s=p.season;return {month:key,points:s?.month===key?s.points:0,previous:[...(s&&s.month!==key?[{month:s.month,points:s.points}]:[]),...(p.seasonHistory??[])].slice(0,3)};}
export function creditSeason(p,t,delta){const s=seasonView(p,t);p.season={month:s.month,points:s.points+delta};p.seasonHistory=s.previous;}
const prompts=['penguin','umbrella','robot','guitar','elephant','airplane','butterfly','basketball','turtle','camera','kangaroo','teapot'];
export function makeCharades(participants,rand){return {actor:participants[rand(participants.length)],prompt:prompts[rand(prompts.length)],winner:null,guesses:{},lastGuess:{}};}
export function guessCharades(q,id,value,t){
 if(id===q.actor||typeof value!=='string'||value.length>32||!/^[a-zA-Z ]{1,32}$/.test(value)||!value.trim()||q.winner||t>=q.endsAt||t<q.startsAt)return false;
 if((q.guesses[id]??0)>=12||(q.lastGuess[id]!==undefined&&t-q.lastGuess[id]<1200))return false;
 q.guesses[id]=(q.guesses[id]??0)+1;q.lastGuess[id]=t;
 if(value.trim().toLowerCase()===q.prompt)q.winner=id;
 return true;
}
