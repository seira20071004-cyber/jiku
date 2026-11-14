import {nodeKind, UNITS, validDateKey} from './model.js';
import {nodeDepth, writeGoal} from './universe-model.js';

export const planningPrompt = `Jikuのマインドマップを一緒に考えてください。最初から完成案やJSONは作らず、次の順に、私の返答を待ちながら進めてください。

1. Jikuで追加先にする目標を確認し、そこから下位目標と具体的なタスクに分けてください。各項目の名前と、それが上位目標につながる理由を決めます。タスクは枝の末端です。
2. タスクごとに、上位目標のために必要な合計時間を見積もってください。必要なら今の実力・残りの教材・使える時間を質問し、見積もりの根拠を示してください。
3. 取り組み始める日と、いつまでに達成したいかを確認してください。1週間に何日取り組めるかも聞き、合計時間から週の目標と取り組む日1日あたりの目標を分単位で決めます。無理がある場合は期限や範囲を一緒に調整してください。
4. ページ数や問題数なども記録したければ、単位と必要な総量、週・1日あたりの量を決めてください。各タスクについて「余裕がある日だけ／忙しい日も／毎日」のどれにするかを聞いてください。
5. 親子関係とすべての設定を確認できる形で提示してください。私が了承したら、続けて送る「JikuのJSON出力テンプレート」を待ってください。`;

export const jsonTemplate = `先ほど私が了承したマインドマップを、以下のJikuのJSON形式に変換してください。未確定の項目があれば先に質問してください。確定後はJSONオブジェクトだけを出力し、説明・コードブロック・コメントを付けないでください。

{
  "version": 1,
  "nodes": [
    {
      "kind": "goal",
      "name": "応用情報技術者試験に合格する",
      "purpose": "技術の基礎力を高めるため",
      "children": [
        {
          "kind": "task",
          "name": "過去問を解く",
          "purpose": "出題傾向を把握し、苦手分野を特定するため",
          "mode": "busy",
          "deadline": "2027-04-01",
          "time": { "total": 1800, "weekly": 300, "daily": 60 },
          "extras": [{ "unit": "questions", "total": 600, "weekly": 100, "daily": 20 }]
        }
      ]
    }
  ]
}

- 上の名前、日付、数値は例です。実際に合意した内容に置き換えてください。
- nodesには、Jikuで選ぶ追加先の「直下」に置く項目だけを並べます。追加先の目標自体は出力しません。上位目標とのつながりは children の入れ子で表現します。
- goalには kind、name、purpose、children を指定します。子がない場合は children: []。最上位の目標の直下にある目標でブラックホール名を決めていれば、任意の symbolName も指定できます。
- taskには kind、name、purpose、mode、deadline、time、extras を指定します。子は持てません。modeは full（余裕がある日だけ）、busy（忙しい日も）、rest（毎日）のいずれかです。deadlineは YYYY-MM-DD。
- time の total、weekly、daily はすべて分単位の正の数です。週と日は取り組める日数を踏まえて計算します。
- extrasが不要なら []。追加の単位は pages（ページ）、count（回）、questions（問）、words（単語）、items（個）、custom（自由入力）から選びます。customの場合は customUnit（例「文」）も指定します。各単位の total、weekly、daily は正の数です。
- 名前は80文字まで、目的・理由は1000文字まで。Jikuの一番上の目標を含めて最大5階層です。下の階層に取り込む場合は、その分だけ浅くしてください。`;

function object(value) {
 return value!==null&&typeof value==='object'&&!Array.isArray(value);
}
function requiredText(value,label,limit){
 if(typeof value!=='string'||!value.trim()||value.trim().length>limit)throw Error(label+'を1〜'+limit+'文字で入力してください。');
 return value.trim();
}
function amounts(value,label){
 if(!object(value))throw Error(label+'を設定してください。');
 for(const [key,period] of [['total','全体'],['weekly','1週間'],['daily','1日']]){
  const amount=value[key];
  if(typeof amount!=='number'||!Number.isFinite(amount)||amount<.001||amount>1000000){
   throw Error(label+'の'+period+'の量は0.001〜1,000,000の数値にしてください。');
  }
 }
 return {totalTarget:value.total,weeklyTarget:value.weekly,dailyAmount:value.daily};
}

export function previewMapImport(state,raw,parentId){
 if(raw.length>500000)throw Error('JSONが大きすぎます。枝ごとに分けて取り込んでください。');
 const text=raw.trim().replace(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i,'$1');
 let plan;
 try{plan=JSON.parse(text)}catch{throw Error('JSONを読み取れませんでした。AIが出力したJSON全体を貼り付けてください。');}
 const parent=state.nodes.find(node=>node.id===parentId);
 if(!parent||nodeKind(state,parentId)!=='goal')throw Error('有効な追加先の目標を選んでください。');
 if(!object(plan)||plan.version!==1||!Array.isArray(plan.nodes)||!plan.nodes.length){
  throw Error('versionが1で、nodesに目標またはタスクが入っているJSONを貼り付けてください。');
 }
 const next=structuredClone(state);
 const counts={goal:0,task:0};
 function add(nodes,currentParent,depth,path){
  return nodes.map((node,index)=>{
   const position=[...path,String(index+1)].join(' › ');
   try {
    if(!object(node)||!['goal','task'].includes(node.kind))throw Error('kindは goal または task にしてください。');
    if(depth>4)throw Error('最上位の目標を含めて5階層まで追加できます。');
    if(next.nodes.length>=1000)throw Error('マップ全体で1,000項目まで追加できます。');
    const name=requiredText(node.name,'名前',80),purpose=requiredText(node.purpose,'目的・理由',1000);
    let taskSettings,symbolName;
    if(node.kind==='task'){
     if(node.children!==undefined)throw Error('タスクから children を外してください。');
     if(!['full','busy','rest'].includes(node.mode))throw Error('modeは full、busy、rest のいずれかにしてください。');
     if(!validDateKey(node.deadline))throw Error('期限を YYYY-MM-DD で入力してください。');
     if(!Array.isArray(node.extras)||node.extras.length>12)throw Error('extrasは0〜12個の単位を含む配列にしてください。');
     const extras=node.extras.map(metric=>{
      if(!object(metric)||(metric.unit!=='custom'&&(!Object.hasOwn(UNITS,metric.unit)||UNITS[metric.unit].dimension==='time'))){
       throw Error('追加の単位を確認してください。');
      }
      return {unit:metric.unit,...amounts(metric,'追加の単位'),
       ...(metric.unit==='custom'?{customUnit:requiredText(metric.customUnit,'単位の名前',12)}:{})};
     });
     taskSettings={mode:node.mode,measurement:{unit:'minutes',deadline:node.deadline,...amounts(node.time,'時間'),extras}};
    }else{
     if(!Array.isArray(node.children))throw Error('目標の children は配列にしてください。');
     if(depth===1&&node.symbolName!==undefined)symbolName=requiredText(node.symbolName,'ブラックホールの名前',80);
    }
    const id=writeGoal(next,{parentId:currentParent,kind:taskSettings?'action':'goal',name,purpose,symbolName,...taskSettings});
    counts[node.kind]++;
    return {id,kind:node.kind,name,purpose,symbolName,...taskSettings,
     children:taskSettings?[]:add(node.children,id,depth+1,[...path,name])};
   }catch(error){
    if(error instanceof ImportItemError)throw error;
    throw new ImportItemError(position+' '+(typeof node?.name==='string'?node.name.slice(0,80)+' — ':'')+error.message);
   }
  });
 }
 const nodes=add(plan.nodes,parentId,nodeDepth(state,parentId)+1,[]);
 return {next,nodes,counts};
}
class ImportItemError extends Error {}
