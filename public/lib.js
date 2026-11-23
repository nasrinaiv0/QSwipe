/** QSwipe demo domain logic. Pure functions are tested independently of the UI. */
export const WORKSPACES = Object.freeze({
  bpo: { name:'Vertex Contact Center', industry:'BPO', groupLabel:'Team', personLabel:'Agent', managerTitle:'Team Leader', shift:'09:00–18:00', target:5 },
  school: { name:'Northfield Academy', industry:'Education', groupLabel:'Class', personLabel:'Student', managerTitle:'Class Adviser', shift:'08:00–15:00', target:5 },
  government: { name:'City Service Office', industry:'Government', groupLabel:'Unit', personLabel:'Staff', managerTitle:'Section Head', shift:'08:00–17:00', target:5 },
  custom: { name:'Creative Studio', industry:'Custom', groupLabel:'Squad', personLabel:'Member', managerTitle:'Team Lead', shift:'10:00–19:00', target:5 }
});
export const PEOPLE = Object.freeze([
  { id:'p1', name:'Mika Santos', position:'Customer Support Specialist', team:'Orion', initials:'MS', portrait:0 },
  { id:'p2', name:'Paolo Reyes', position:'Technical Support Agent', team:'Orion', initials:'PR', portrait:1 },
  { id:'p3', name:'Lea Dela Cruz', position:'Quality Analyst', team:'Orion', initials:'LC', portrait:2 },
  { id:'p4', name:'Ari Mendoza', position:'Customer Support Specialist', team:'Orion', initials:'AM', portrait:0 },
  { id:'p5', name:'Rin Garcia', position:'Customer Support Specialist', team:'Orion', initials:'RG', portrait:2 },
  { id:'p6', name:'Cris Villanueva', position:'Customer Support Agent', team:'Nova', initials:'CV', portrait:1 }
]);
export const FACTS = Object.freeze([
  ['Science','What planet is known as the Red Planet?',['Mars','Venus','Mercury','Jupiter'],0],
  ['Science','How many chambers are in the human heart?',['Two','Three','Four','Five'],2],
  ['Science','Which gas do plants absorb during photosynthesis?',['Oxygen','Nitrogen','Carbon dioxide','Helium'],2],
  ['Science','What is the chemical symbol for gold?',['Go','Au','Ag','Gd'],1],
  ['Science','Which part of a plant mainly absorbs water from soil?',['Petal','Root','Stem','Fruit'],1],
  ['Geography','What is the capital city of Japan?',['Osaka','Kyoto','Tokyo','Nagoya'],2],
  ['Geography','What is the largest ocean on Earth?',['Indian','Arctic','Pacific','Atlantic'],2],
  ['Geography','Which continent contains the Sahara Desert?',['Asia','Africa','Europe','Australia'],1],
  ['Geography','What is the capital of the Philippines?',['Cebu','Davao','Manila','Vigan'],2],
  ['Geography','Which country is home to Machu Picchu?',['Peru','Chile','Mexico','Brazil'],0],
  ['History','In what year did World War II end?',['1943','1945','1947','1950'],1],
  ['History','What civilization built the pyramids at Giza?',['Romans','Ancient Egyptians','Mayans','Vikings'],1],
  ['History','Who was the first person to walk on the Moon?',['Yuri Gagarin','Neil Armstrong','Buzz Aldrin','Alan Shepard'],1],
  ['History','In what year did the Philippines declare independence from Spain?',['1896','1898','1901','1946'],1],
  ['Arts','Who painted the Mona Lisa?',['Michelangelo','Van Gogh','Leonardo da Vinci','Raphael'],2],
  ['Arts','How many strings does a standard violin have?',['Three','Four','Five','Six'],1],
  ['Arts','What is the primary language of the opera Carmen?',['German','Italian','French','Spanish'],2],
  ['Sports','How many players are on the court per basketball team?',['Four','Five','Six','Seven'],1],
  ['Sports','In tennis, what is a score of zero called?',['Nil','Blank','Love','Zero'],2],
  ['Sports','Which sport uses a shuttlecock?',['Squash','Badminton','Tennis','Cricket'],1],
  ['Technology','What does CPU stand for?',['Central Processing Unit','Computer Power Utility','Core Program Unit','Central Peripheral Unit'],0],
  ['Technology','What does HTML stand for?',['HyperText Markup Language','HighText Main Language','Hyperlink Text Model Language','Home Tool Markup Language'],0],
  ['Technology','What does HTTPS add to HTTP?',['Compression','Encryption in transit','More images','Faster clocks'],1],
  ['Food','What is the main ingredient in traditional guacamole?',['Tomato','Avocado','Cucumber','Potato'],1],
  ['Food','What grain is traditionally used for risotto?',['Barley','Rice','Wheat','Corn'],1],
  ['General','How many sides does a hexagon have?',['Five','Six','Seven','Eight'],1],
  ['General','Which month follows September?',['August','October','November','December'],1],
  ['General','What color do you get by mixing blue and yellow paint?',['Orange','Purple','Green','Pink'],2]
]);

export function parseEntries(value, max=20){
  if(typeof value!=='string') return [];
  const seen = new Set();
  return value.split(/\r?\n/).map(x=>x.trim()).filter(x=>{
    const key=x.toLocaleLowerCase();
    if(!x || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0,max).map(x=>x.slice(0,70));
}
export function rollIndex(limit, bytes){
  if(!Number.isSafeInteger(limit)||limit<1) throw Error('Invalid draw size');
  if(bytes===undefined){
    const maximum=0x100000000-(0x100000000 % limit);
    const sample=new Uint32Array(1);
    do { crypto.getRandomValues(sample); bytes=sample[0]; } while (bytes>=maximum);
  }
  return bytes % limit;
}
export function rosterStats(people,records){
  const counts={scheduled:people.length,present:0,absent:0,pending:0};
  for(const p of people){const status=records[p.id];if(status==='present') counts.present++;else if(status==='absent') counts.absent++;else counts.pending++;}
  return counts;
}
export function pendingPeople(people,records){return people.filter(p=>!['present','absent'].includes(records[p.id]));}
export function commitmentStats(people,commitments){
  const counts={confirmed:0,atRisk:0,unavailable:0,pending:0};
  for(const p of people){let x=commitments[p.id];if(x==='confirmed')counts.confirmed++;else if(x==='risk')counts.atRisk++;else if(x==='unavailable')counts.unavailable++;else counts.pending++;}
  return counts;
}
export function projectedCoverage(counts){return counts.confirmed; /* Conservative first-release forecast; no arbitrary prediction weights. */}
export function shouldAllowOverride(role,person,records){return role==='manager' && !!person && !['present','absent'].includes(records[person.id]);}
export function dateLabel(date){return new Intl.DateTimeFormat('en-PH',{year:'numeric',month:'short',day:'numeric'}).format(new Date(date+'T12:00:00'));}
export function mathQuestion(seed){
  const a=1+(seed%1000), b=1+(Math.floor(seed/1000)%1000);
  const operation=Math.floor(seed/1_000_000)%4;
  let question,answer;
  if(operation===0){question=`What is ${a} + ${b}?`;answer=a+b;}
  else if(operation===1){question=`What is ${a} − ${b}?`;answer=a-b;}
  else if(operation===2){question=`What is ${a} × ${b}?`;answer=a*b;}
  else {question=`What is ${a*b} ÷ ${b}?`;answer=a;}
  const choices=[answer,answer+1,answer-2,answer+3];
  const offset=seed%4; const shifted=[...choices.slice(offset),...choices.slice(0,offset)];
  return {category:'Math',question,options:shifted,answer:shifted.indexOf(answer)};
}
export function triviaQuestion(seed,category='Mixed'){
  const eligible=FACTS.filter(f=>category==='Mixed'||f[0]===category);
  if(category==='Math'||(category==='Mixed' && seed%6===0))return mathQuestion(seed);
  const f=eligible[seed%eligible.length]||FACTS[seed%FACTS.length];
  return {category:f[0],question:f[1],options:[...f[2]],answer:f[3]};
}
