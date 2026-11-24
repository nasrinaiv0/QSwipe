export const THEMES=['pond','space','garden'];
export const INKS=['ink','jade','rose','gold'];
export function validStroke(points,color){
 return INKS.includes(color)&&Array.isArray(points)&&points.length>=2&&points.length<=32&&points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isInteger(n)&&n>=0&&n<=1000));
}
const clean=(x,max)=>typeof x==='string'&&x.trim()&&x.length<=max&&!/[\u0000-\u001f\u007f]/.test(x)?x.trim():null;
export function customQuestion(text,options,answer){
 const question=clean(text,100);
 if(!question||!Array.isArray(options)||options.length!==4||!Number.isInteger(answer)||answer<0||answer>3)return null;
 const choices=options.map(x=>clean(x,48));
 if(choices.some(x=>!x)||new Set(choices.map(x=>x.toLowerCase())).size!==4)return null;
 return {text:question,options:choices,answer};
}
export const SEASON_REWARDS=[{id:'comet',label:'Comet pin',threshold:50},{id:'aurora',label:'Aurora scarf',threshold:150},{id:'starlight',label:'Starlight crown',threshold:300}];
export function rewardOptions(p){return SEASON_REWARDS.map(x=>({...x,unlocked:(p.seasonRewards??[]).includes(x.id)}));}
export function grantSeasonRewards(p){const owned=new Set(p.seasonRewards??[]);for(const x of SEASON_REWARDS)if((p.season?.points??0)>=x.threshold)owned.add(x.id);p.seasonRewards=SEASON_REWARDS.filter(x=>owned.has(x.id)).map(x=>x.id);}
