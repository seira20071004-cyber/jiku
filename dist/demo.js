import {applyMode,dateKey,shiftDate,modesForLevel,validate} from './model.js';
import {freshUniverse} from './universe-model.js';
// A separate, editable testing universe. Never reads or changes the real workspace.
export function createDemoUniverse(today=dateKey()){
 const s=freshUniverse();s.nodes[0].name='自分が望む人生を、少しずつ形にする';s.nodes[0].kind='goal';
 const goal=(id,parentId,name,description)=>s.nodes.push({id,parentId,name,description,kind:'goal',symbolName:name});
 const task=(id,parentId,name,amount,unit,target,mode,customUnit)=>{s.nodes.push({id,parentId,name,description:'毎日の小さな積み重ねを、この目標につなげる。',kind:'action'});s.settings[id]={priority:1,type:'continuous',status:'active',modes:modesForLevel(mode),measurement:{unit,dailyAmount:amount,weeklyTarget:target,...(customUnit?{customUnit}:{})}}};
 const galaxies=[
 ['dev','自分のプロダクトを育てる',[
  ['craft','つくる力を磨く',[
   ['build','設計と実装',[
    ['code','個人開発を進める',45,'minutes',180,'full'],['fix','小さな不具合を直す',15,'minutes',60,'busy'],['memo','開発メモを書く',1,'count',5,'rest']]],
   ['learn','開発の基礎',[
    ['article','技術記事を読む',3,'pages',15,'busy'],['design','設計を見直す',20,'minutes',60,'full']]]]],
  ['deliver','届ける力を育てる',[
   ['feedback','使う人に届ける',[
    ['voice','ユーザーの声を読む',10,'minutes',40,'busy'],['idea','改善案を1つ残す',1,'count',5,'rest'],['ui','画面の使いやすさを磨く',30,'minutes',120,'full']]],
   ['release','公開と発信',[
    ['share','開発の進捗を発信',1,'count',3,'busy'],['ship','リリースの準備をする',30,'minutes',90,'full']]]]]]],
 ['english','英語で世界とつながる',[
  ['language','言葉の土台をつくる',[
   ['vocab','語彙力を高める',[
    ['words','英単語を10個覚える',10,'words',50,'busy'],['examples','例文を読む',5,'count',25,'busy'],['one-word','単語を1つ見返す',1,'words',5,'rest']]],
   ['reading','英文を理解する',[
    ['grammar','文法問題に取り組む',5,'questions',25,'full'],['read','英文を読む',2,'pages',10,'busy']]]]],
  ['communication','英語を使う力を育てる',[
   ['sound','音と発音に親しむ',[
    ['shadow','シャドーイング',15,'minutes',60,'full'],['listen','英語を聞く',10,'minutes',40,'busy'],['one-sentence','英文を1文音読する',1,'count',5,'rest']]],
   ['speak','自分の言葉で伝える',[
    ['diary','英語日記を書く',3,'custom',15,'busy','文'],['talk','英会話の練習をする',20,'minutes',60,'full']]]]]]],
 ['health','心と体を整える',[
  ['body','体を大切にする',[
   ['move','心地よく体を動かす',[
    ['walk','外の空気を吸って歩く',20,'minutes',100,'busy'],['stretch','体をほぐす',5,'minutes',25,'rest'],['exercise','軽い筋トレをする',15,'minutes',60,'full']]],
   ['sleep','よく眠る準備をする',[
    ['screen','就寝前に画面を置く',1,'count',5,'rest'],['sleep-note','睡眠のメモを残す',1,'count',5,'busy']]]]],
  ['mind','心の余白を育てる',[
   ['books','読書で視野を広げる',[
    ['book','好きな本を読む',10,'pages',50,'busy'],['book-note','読書メモを残す',1,'count',3,'full'],['one-page','本を1ページ開く',1,'pages',5,'rest']]],
   ['reflect','自分と向き合う',[
    ['feeling','一日の気持ちをひと言残す',1,'count',5,'rest'],['review','週の振り返りをする',15,'minutes',30,'full']]]]]]]
 ];
 for(const [gId,gName,systems] of galaxies){const galaxy='demo-'+gId;goal(galaxy,'root',gName,'望む未来のために、大切にしたいこと。');for(const [sId,sName,planets] of systems){const system=galaxy+'-'+sId;goal(system,galaxy,sName,'大きな目標につながる力を育てる。');for(const [pId,pName,tasks] of planets){const planet=system+'-'+pId;goal(planet,system,pName,'毎日の取り組みを、具体的な変化につなげる。');for(const [id,name,amount,unit,target,mode,customUnit] of tasks)task(planet+'-'+id,planet,name,amount,unit,target,mode,customUnit)}}}
 s.universe={version:1,onboarded:true,lastModePrompt:today};s.demo={version:1,generatedOn:today};
 const pattern=['full','busy','rest','full','busy','full','rest'];for(let offset=-34;offset<=0;offset++){const date=shiftDate(today,offset),mode=offset===0?'full':pattern[(offset+35)%7];applyMode(s,date,mode,date)}
 return validate(s);
}
