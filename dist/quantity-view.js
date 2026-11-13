import {weeklyTaskSections,weeklyAchievement,timeGoalProgress} from './universe-model.js';
import {UNITS,MODES,taskLevel,modeTotals,unitInfo,quantitySummary,setting,leaves,ancestry,descendants,shiftDate,weekStart,isEventTask,eventCompletionDate,goalIds,timeMeasurement,taskRecordFields} from './model.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const numberText=n=>new Intl.NumberFormat('ja-JP',{maximumFractionDigits:3}).format(n);
function minuteInput(label,name,value='',required=true){
 return `<label>${label}<span class="task-week-target-entry"><input type="number" inputmode="decimal" name="${name}" min="0.001" max="1000000" step="any" ${required?'required':''} value="${esc(value??'')}" aria-label="${label}"><span>分</span></span></label>`;
}
function targetCalculator({time=false,total=null}={}){
 return `<details class="target-calculator">
  <summary>逆算して計算する</summary>
  <p>今日から期限まで、毎日均等に取り組む場合の目安です。</p>
  <div class="task-target-grid">
   <label>${time?'上位目標に必要な時間（分）':'上位目標に必要な量'}<input data-calc-total type="number" inputmode="decimal" step="any" value="${esc(total??'')}"></label>
   <label>いつまでに達成したいか<input data-calc-date type="date"></label>
  </div>
  <div class="target-calculator-actions"><button type="button" data-calculate-target>計算する</button>
   <button type="button" data-apply-target hidden>目標に反映</button></div>
  <output data-calc-result aria-live="polite"></output>
 </details>`;
}
function quantitySettingsFields(m){
 return `<section class="task-amount-config" data-target-fields="time">
  <h3>目標時間</h3>
  <div class="task-target-grid task-target-three">
   ${minuteInput('全体の目標時間','total-minutes',m.totalTarget,false)}
   ${minuteInput('1週間の目標時間','weekly-minutes',m.weeklyTarget,false)}
   ${minuteInput('1日の目標時間','daily-minutes',m.dailyAmount)}
  </div>
  ${targetCalculator({time:true,total:m.totalTarget})}
  <details class="task-monthly-target" ${m.monthlyTarget?'open':''}><summary>1ヶ月の目標時間（任意）</summary>
   ${minuteInput('1ヶ月の目標時間','monthly-minutes',m.monthlyTarget,false)}
  </details>
 </section>`;
}
export function extraMetricFields(metric={},event=false){
 const unit=metric.unit||'';
 const amountInput=(label,field,value,required=false)=>`<label>${label}<input type="number" inputmode="decimal" name="${field}" min="0.001" max="1000000" step="any" ${required?'required':''} value="${esc(value??'')}"></label>`;
 return `<div class="extra-metric" data-extra-metric data-target-fields="extra">
  <div class="extra-metric-top"><label>追加の単位<select name="extra-unit" required><option value="">選択してください</option>${Object.entries(UNITS).filter(([,u])=>u.dimension!=='time').map(([key,u])=>`<option value="${key}" ${unit===key?'selected':''}>${u.label}</option>`).join('')}<option value="custom" ${unit==='custom'?'selected':''}>自由入力</option></select></label><button type="button" class="text-button" data-remove-extra aria-label="追加の単位を削除">×</button></div>
  <label data-extra-custom ${unit==='custom'?'':'hidden'}>単位の名前<input name="extra-custom-unit" maxlength="12" value="${esc(metric.customUnit||'')}" ${unit==='custom'?'required':'disabled'}></label>
  ${event?amountInput('取り組む日の量','extra-daily',metric.dailyAmount,true):`
   <div class="task-target-grid task-target-three">
    ${amountInput('全体の目標','extra-total',metric.totalTarget)}
    ${amountInput('1週間の目標','extra-weekly',metric.weeklyTarget)}
    ${amountInput('1日の目標','extra-daily',metric.dailyAmount,true)}
   </div>
   ${targetCalculator({total:metric.totalTarget})}
   <details class="task-monthly-target" ${metric.monthlyTarget?'open':''}><summary>1ヶ月の目標（任意）</summary>
    ${amountInput('1ヶ月の目標','extra-monthly',metric.monthlyTarget)}
   </details>`}
 </div>`;
}
function extraRecordFields(metrics=[],amounts=[]){
 if(!metrics.length)return '';
 return `<section class="extra-record-fields"><h3>追加の記録（任意）</h3><div class="task-target-grid">
  ${metrics.map((metric,index)=>{const {label}=unitInfo(metric);return `<label>${esc(label)}<input name="record-extra" type="number" inputmode="decimal" min="0.001" max="1000000" step="any" value="${esc(amounts[index]??'')}"></label>`}).join('')}
 </div></section>`;
}
export function taskLevelFields(a,name='task-level'){const selected=taskLevel(a),options=[{value:'full',title:'余裕がある日だけ',days:['full']},{value:'busy',title:'忙しい日も',days:['full','busy']},{value:'rest',title:'毎日取り組む',days:['full','busy','rest']}];return `<fieldset class="task-schedule-config"><legend>どんな日に取り組みますか？</legend><p class="task-setting-caption">1つ選ぶと、対象の日が自動で決まります。</p><div class="task-schedule-options">${options.map(o=>`<label class="task-schedule-option"><input type="radio" required name="${esc(name)}" value="${o.value}" ${selected===o.value?'checked':''}><span class="task-schedule-copy"><strong>${o.title}</strong><span class="task-day-tags">${o.days.map(d=>`<span>${MODES[d].icon} ${MODES[d].label}</span>`).join('')}</span></span><span class="task-schedule-check" aria-hidden="true">✓</span></label>`).join('')}</div><p class="task-fixed-note">どの日も、設定した量は同じです。</p></fieldset>`}
export function taskSettingsFields(s,id){
 const action=setting(s,id),event=isEventTask(action),m=timeMeasurement(action.measurement||{unit:'minutes'});
 return `${event?`
  <input type="hidden" name="task-format" value="event">
  <label>イベントの日付（任意）<input type="date" name="event-date" value="${esc(action.eventDate||'')}"></label>
  ${minuteInput('イベントに取り組む時間','event-minutes',m.dailyAmount)}
 `:`${quantitySettingsFields(m)}${taskLevelFields(action)}`}
 <section class="task-extra-config">
  <h3>追加の記録（任意）</h3><p>ページ数、単語数、回数など、必要な単位を追加できます。</p>
  <div data-extra-list>${(m.extras||[]).filter(metric=>metric.dailyAmount!=null||metric.totalTarget!=null||metric.weeklyTarget!=null||metric.monthlyTarget!=null).map(metric=>extraMetricFields(metric,event)).join('')}</div>
  <button type="button" class="text-button add-extra-unit" data-add-extra>＋ 別の単位の目標を設定する</button>
 </section>`;
}
export function eventPanel(s,id,date,today){
 const node=s.nodes.find(n=>n.id===id),action=setting(s,id),done=eventCompletionDate(s,id);
 const m=timeMeasurement(action.measurement||{unit:'minutes'});
 const displayDate=done||(action.eventDate&&action.eventDate<=today?action.eventDate:date);
 const log=done?s.logs[done][id]:null;
 return `<div class="dialog-title"><div><div class="eyebrow">イベント</div><h2>${esc(node.name)}</h2></div><button class="round-button" data-do="close" aria-label="閉じる">×</button></div>
 ${node.description?`<p class="space-description">${esc(node.description)}</p>`:''}
 <p class="event-state">${done?'完了 · '+esc(done):action.eventDate?'予定 · '+esc(action.eventDate):'日付未定'}${log?.eventMinutes?' · '+hoursText(log.eventMinutes/60):''}${(log?.eventQuantities||[]).map(q=>' · '+numberText(q.amount)+esc(unitInfo(q.measurement).label)).join('')}</p>
 ${done?`<button class="text-button" data-undo-event="${esc(id)}">完了を取り消す</button>`:`<form id="event-form" data-id="${esc(id)}">
  <label>完了した日<input name="event-completed-date" type="date" required max="${today}" value="${displayDate}"></label>
  ${minuteInput('取り組んだ時間','record-minutes',m.dailyAmount)}
  ${extraRecordFields(m.extras,m.extras?.map(metric=>metric.dailyAmount))}
  <div class="dialog-actions"><button class="primary" type="submit">完了を記録</button></div></form>`}
 <button class="text-button" data-edit="${esc(id)}">イベントの設定を編集 →</button>`;
}
export function modePickerContent(s,key){const current=s.records[key]?.mode;return `<div class="dialog-title"><div><div class="eyebrow">${Number(key.slice(5,7))}月${Number(key.slice(8))}日</div><h2>今日は、どのペース？</h2></div><button class="round-button" data-do="close" aria-label="閉じる">×</button></div><p class="mode-picker-note">タスクに保存した固定量を、そのまま反映します。</p><div class="quick-mode-options">${['full','busy','rest'].map(k=>{const m=MODES[k],summary=modeTotals(s,k);return `<button data-mode="${k}" data-date="${key}" class="quick-mode ${k} ${current===k?'chosen':''}"><span class="quick-mode-icon">${m.icon}</span><div><strong>${m.label}</strong><small>${summary.count?[...summary.groups].sort((a,b)=>Number(b.dimension==='time')-Number(a.dimension==='time')).map(g=>g.dimension==='time'?hoursText(g.total):numberText(g.total)+esc(g.unit)).join(' ・ '):'固定量を設定したタスクはありません'}</small></div><i>${current===k?'✓':'→'}</i></button>`}).join('')}</div>${Object.values(s.logs[key]||{}).some(l=>l.quantity&&l.source!=='mode')?'<p class="footnote">この日だけ修正した量は、そのまま残ります。</p>':''}<div class="mode-picker-footer"><button class="text-button" data-configure-leaves>タスクの量を設定する</button><button class="text-button quiet" data-do="close">あとで</button></div>`}
export function recordPanel(s,id,date,today){
 const node=s.nodes.find(n=>n.id===id);
 if(!node)return '';
 const old=s.logs[date]?.[id],m=taskRecordFields(s,date,id),week=weekStart(date);
 const summary=quantitySummary(s,week,shiftDate(week,6),id,false);
 const hours=summary.groups.find(group=>group.dimension==='time')?.total||0;
 return `<form id="quantity-form" data-id="${esc(id)}">
  <div class="dialog-title"><div><div class="eyebrow">${esc(ancestry(s,id).slice(1,-1).join(' / ')||'自分の宇宙')}</div><h2>${esc(node.name)}</h2></div><button type="button" class="round-button" data-do="close" aria-label="閉じる">×</button></div>
  <label>記録する日<input type="date" name="record-date" value="${date}" max="${today}" required></label>
  ${minuteInput('この日に取り組んだ時間','record-minutes',m.dailyAmount)}
  <div class="quantity-increments">${[10,30,60].map(minutes=>`<button type="button" data-add-quantity="${minutes}">＋${minutes}分</button>`).join('')}</div>
  ${extraRecordFields(m.extras,m.extraAmounts)}
  <div class="record-week-summary"><span>この週の合計</span><strong>${hoursText(hours)}</strong></div>
  ${old?.source==='mode'?'<p class="footnote">モードから反映した記録です。この日だけ調整できます。</p>':''}
  <div class="dialog-actions"><button type="button" class="text-button" data-open-preset="${esc(id)}">タスクの設定</button><button type="submit" class="primary">記録する</button></div>
  ${old?.quantity?`<button type="button" class="text-button danger remove-quantity" data-remove-quantity="${esc(id)}" data-log-date="${date}">この日の記録を削除</button>`:''}
 </form>`;
}
const formatHours=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:2});
const hoursNumber=hours=>hours>0&&hours<.01?numberText(hours):formatHours.format(hours);
export const hoursText=hours=>hoursNumber(hours)+'時間';
function taskDetails(s,section,targetLabel,editableIds,start,end,today){
 const tasks=new Map();
 for(const row of section.rows){
  if(!tasks.has(row.id))tasks.set(row.id,[]);
  tasks.get(row.id).push(row);
 }
 return `<section class="weekly-goal-section"><h2><span>✧</span>${esc(section.name)}</h2>${[...tasks.values()].map(metrics=>{
  const sorted=[...metrics].sort((a,b)=>Number(b.dimension==='time')-Number(a.dimension==='time'));
  const task=sorted[0],editable=!task.deleted&&editableIds.has(task.id);
  const date=metrics.flatMap(row=>Object.keys(row.byDate)).sort().at(-1)||(end<today?end:today);
  return `<article class="period-task">
   <header><strong>${esc(task.name)}</strong>${task.deleted?'<small>過去のタスク</small>':''}
   ${editable?`<button type="button" data-record-leaf="${esc(task.id)}" data-log-date="${date}" aria-label="${esc(task.name)}の記録を修正">›</button>`:''}</header>
   ${sorted.map(row=>{
    const actual=row.achievementAmount??row.amount;
    const progress=weeklyAchievement(actual,row.target);
    const tone=achievementTone(actual,row.target,row.target*completedDayShare(start,end,today));
    return `<div class="period-task-metric"><div><strong>${row.dimension==='time'?hoursText(row.amount):numberText(row.amount)+esc(row.unit)}</strong>
      ${progress?`<span class="${tone}">${targetLabel} ${row.dimension==='time'?hoursText(row.target):numberText(row.target)+esc(row.unit)} · ${progress.percent}%</span>`:''}</div>
      ${progress?`<div class="weekly-task-progress-track ${tone}" role="progressbar" aria-label="${esc(task.name)}の${targetLabel}達成度（${esc(row.unit)}）" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.bar}" aria-valuetext="${progress.percent}%"><i style="width:${progress.bar}%"></i></div>`:''}
     </div>`;
   }).join('')}
   ${editable&&!isEventTask(setting(s,task.id))&&!sorted.some(row=>row.dimension==='time'&&row.hasTarget)?`<button type="button" class="text-button" data-open-preset="${esc(task.id)}">目標時間を設定 →</button>`:''}
  </article>`;
 }).join('')}</section>`;
}
function monthOffset(month, offset) {
 const date = new Date(month+'-01T00:00:00Z');
 date.setUTCMonth(date.getUTCMonth()+offset);
 return date.toISOString().slice(0,7);
}

function recentActivity(summary, events, start, end, today) {
 const recordedDays=new Set([...summary.entries.map(entry=>entry.date),...events.map(event=>event.date)]);
 const timeByDay=summary.groups.find(group=>group.dimension==='time')?.byDate||{};
 const peak=Math.max(0,...Object.values(timeByDay));
 const days=[],totals=[];
 let accumulated=0;
 for(let day=start;day<=end;day=shiftDate(day,1)){
  const recorded=day<=today&&recordedDays.has(day);
  const color=recorded ? Math.max(1,Math.ceil(3*(timeByDay[day]||0)/(peak||1))) : 0;
  const title=day+' '+(day>today?'これから':recorded?(timeByDay[day]?hoursText(timeByDay[day]):'記録あり'):'記録なし');
  days.push(`<span data-intensity="${color}" ${day>today?'data-future':''} title="${title}"></span>`);
  if(day<=today){accumulated+=timeByDay[day]||0;totals.push(accumulated)}
 }
 const bars=accumulated?totals.map(value=>`<i style="--height:${value/accumulated*100}%"></i>`).join(''):'';
 return `<section class="report-activity">
  <h2>日々の記録</h2>
  <p><strong>${recordedDays.size}日</strong>記録しました</p>
  <div class="report-days" role="img" aria-label="${start}から${end}の記録 ${recordedDays.size}日">
   ${days.join('')}
  </div>
  <div class="report-days-key">1マス＝1日 · 色が明るいほど記録した時間が長い</div>
  ${bars?`<h3>期間内の累積時間 <strong>${hoursText(accumulated)}</strong></h3>
   <div class="report-cumulative" role="img" aria-label="期間内の累積時間は ${hoursText(accumulated)}">${bars}</div>`:''}
 </section>`;
}

function monthShare(start,end){
 let fraction=0;
 for(let month=start.slice(0,7);month<=end.slice(0,7);month=monthOffset(month,1)){
  const last=Number(shiftDate(monthOffset(month,1)+'-01',-1).slice(8));
  const from=month===start.slice(0,7)?Number(start.slice(8)):1;
  const through=month===end.slice(0,7)?Number(end.slice(8)):last;
  fraction+=(through-from+1)/last;
 }
 return fraction;
}

export function analysisData(state,{start,end,weeks}){
 const periods=Array.from({length:weeks},(_,index)=>{
  const from=shiftDate(start,index*7);
  return {from,to:shiftDate(from,6)};
 });
 const root=state.nodes.find(node=>node.parentId===null);
 const items=new Map(state.nodes.map(node=>[node.id,{
  ...node,children:[],actual:0,target:0,weekly:periods.map(()=>({actual:0,target:0}))
 }]));
 for(const item of items.values())items.get(item.parentId)?.children.push(item);
 const summary=quantitySummary(state,start,end,'all',false);
 const timeRows=new Map(summary.rows.filter(row=>row.dimension==='time').map(row=>[row.id,row.byDate]));
 const weeksByDate=new Map(periods.flatMap(({from},index)=>
  Array.from({length:7},(_,offset)=>[shiftDate(from,offset),index])));
 const monthShares=periods.map(({from,to})=>monthShare(from,to));
 for(const node of leaves(state)){
  const task=setting(state,node.id);
  if(node.kind==='goal'||isEventTask(task))continue;
  const item=items.get(node.id);
  const time=timeMeasurement(task.measurement||{unit:'minutes'});
  item.weekly.forEach((week,index)=>{
   week.target=(time.weeklyTarget||((time.monthlyTarget||0)*monthShares[index]))/60;
  });
  for(const [date,hours] of Object.entries(timeRows.get(node.id)||{})){
   const week=item.weekly[weeksByDate.get(date)];
   if(week)week.actual+=hours;
  }
 }
 function aggregate(item){
  item.children.forEach(child=>{
   aggregate(child);
   child.weekly.forEach((week,index)=>{
    const parent=item.weekly[index];
    parent.target+=week.target;
    if(week.target>0)parent.actual+=week.actual;
   });
  });
  item.actual=item.weekly.reduce((sum,week)=>sum+week.actual,0);
  item.target=item.weekly.reduce((sum,week)=>sum+week.target,0);
 }
 aggregate(items.get(root.id));
 return {items,root:items.get(root.id),periods};
}

const percent=(actual,target)=>target>0?Math.round(actual/target*100):null;
function completedDayShare(from,to,today){
 const day=86400000, first=Date.parse(from);
 const length=(Date.parse(to)-first)/day+1;
 return Math.max(0,Math.min(1,(Date.parse(today)-first)/day/length));
}
export function achievementTone(actual,target,due=target){
 if(actual===null||!(target>0))return '';
 if(actual>=target)return 'rate-reached';
 if(!(due>0))return '';
 const pace=actual/due;
 if(pace<=.5)return 'rate-low';
 if(pace<=.8)return 'rate-mid';
 return '';
}
const percentText=(actual,target)=>target>0?numberText(percent(actual,target))+'%':'目標未設定';
const shortDate=date=>Number(date.slice(5,7))+'/'+Number(date.slice(8));

function trendChart(item,periods,dueTargets){
 const weekly=item.weekly;
 let totalActual=0,totalTarget=0,totalDue=0;
 const values=weekly.map(({actual,target},index)=>{
  const due=dueTargets[index];
  if(target>0){totalActual+=actual;totalTarget+=target;totalDue+=due;}
  return {...periods[index],actual,target,rate:percent(actual,target),cumulative:percent(totalActual,totalTarget),
   rateTone:achievementTone(actual,target,due),cumulativeTone:achievementTone(totalActual,totalTarget,totalDue)};
 });
 const height=148,left=40,right=47,step=58,width=Math.max(300,left+right+step*values.length);
 const top=20,base=top+height;
 const maxHours=Math.max(1,...values.flatMap(({actual,target})=>[actual,target]));
 const maxRate=Math.ceil(Math.max(125,...values.flatMap(value=>[value.rate||0,value.cumulative||0]))/25)*25;
 const x=index=>left+(width-left-right)*(index+.5)/values.length;
 const y=(amount,max)=>base-height*amount/max;
 const line=(key,kind)=>{
  let path='',active=false;
  const dots=values.map((value,index)=>{
   if(value[key]===null){active=false;return '';}
   const cx=x(index),cy=y(value[key],maxRate);
   path+=(active?'L':'M')+cx+' '+cy;active=true;
   const tone=value[key+'Tone'];
   return `<circle class="${tone}" cx="${cx}" cy="${cy}" r="3.2"/>${kind==='rate'?`<text class="trend-value ${tone}" x="${cx}" y="${cy-8}" text-anchor="middle">${numberText(value[key])}%</text>`:''}`;
  }).join('');
  return `<g class="trend-${kind}"><path d="${path}"/>${dots}</g>`;
 };
 return `<h3>${esc(item.name)}の週ごとの推移</h3>
  <div class="trend-legend"><span>目標時間</span><span>実績時間</span><span>週の達成率</span><span>累計達成率</span><span>100%ライン</span></div>
  <div class="trend-plot" tabindex="0" role="img" aria-label="${esc(values.map(value=>`${shortDate(value.from)}の週、達成率${value.rate??'未設定'}${value.rate===null?'':'%'}、累計${value.cumulative??'未設定'}${value.cumulative===null?'':'%'}`).join('。'))}">
   <svg viewBox="0 0 ${width} 198" style="--plot-min:${values.length<=4?0:width}px" aria-hidden="true">
    ${[0,.25,.5,.75,1].map(fraction=>{
     const position=y(fraction,1);
     return `<path class="trend-grid" d="M${left} ${position}H${width-right}"/>
      <text x="${left-6}" y="${position+3}" text-anchor="end">${numberText(Math.round(maxHours*fraction*10)/10)}h</text>
      <text x="${width-right+6}" y="${position+3}">${Math.round(maxRate*fraction)}%</text>`;
    }).join('')}
    <path class="trend-reference" d="M${left} ${y(100,maxRate)}H${width-right}"/>
    ${values.map(({actual,target,from},index)=>`<rect class="trend-target" x="${x(index)-15}" y="${y(target,maxHours)}" width="13" height="${height*target/maxHours}" rx="3"/>
     <rect class="trend-actual" x="${x(index)+2}" y="${y(actual,maxHours)}" width="13" height="${height*actual/maxHours}" rx="3"/>
     <text x="${x(index)}" y="188" text-anchor="middle">${shortDate(from)}</text>`).join('')}
    ${line('rate','rate')}${line('cumulative','cumulative')}
   </svg>
  </div>`;
}

function hierarchyChart(root,current,tone){
 const rows=[];
 function visit(item,depth){
  const first=rows.length;
  if(item.children.length)for(const child of item.children)visit(child,depth+1);
  else rows.push({path:[],leaf:item,depth});
  rows[first].path.unshift({item,depth,span:rows.length-first});
 }
 visit(root,0);
 const columns=Math.max(...rows.map(row=>row.depth))+1;
 const rate=item=>item.target>0?numberText(percent(item.actual,item.target))+'%':'—';
 const button=(item,vertical)=>`<button data-analysis-item="${esc(item.id)}" aria-current="${item===current}"
   class="${vertical?'hierarchy-vertical':''}">
   <span>${esc(item.name)}</span>${item.children.length?`<b class="${tone(item)}">${rate(item)}</b>`:''}
  </button>`;
 return `<h3>達成率</h3>
  <div class="hierarchy-table-wrap" tabindex="0" aria-label="目標の階層表。横にスクロールできます">
   <table class="hierarchy-table" aria-label="目標とタスクの達成率">
    <thead><tr>${Array.from({length:columns},(_,i)=>`<th scope="col">${i===0?'大きな目標':i===1?'内訳':i===columns-1?'詳細':'下位目標'}</th>`).join('')}<th scope="col">達成率</th></tr></thead>
    <tbody>${rows.map(({path,leaf,depth})=>`<tr>
     ${path.map(({item,depth:level,span})=>`<td rowspan="${span}" class="${item.children.length||level===0?'hierarchy-group':'hierarchy-leaf'}">${button(item,item.children.length>0||level===0)}</td>`).join('')}
     ${depth+1<columns?`<td class="hierarchy-empty" colspan="${columns-depth-1}"></td>`:''}
     <td class="hierarchy-rate ${tone(leaf)}" title="実績 ${hoursText(leaf.actual)}${leaf.target?' / 目標 '+hoursText(leaf.target):''}">${rate(leaf)}</td>
    </tr>`).join('')}</tbody>
   </table>
  </div>`;
}

function achievementCards(item,parent,tone){
 const card=(row,summary=false)=>{
  const rate=percent(row.actual,row.target),difference=row.actual-row.target;
  const tag=summary?'div':'button';
  return `<${tag} class="achievement-card ${tone(row)}" ${summary?'':`type="button" data-analysis-item="${esc(row.id)}"`}>
   <strong>${summary?'この目標の達成率':esc(row.name)}</strong>
   <span class="achievement-ring" style="--progress:${Math.min(100,rate||0)}%"><b>${percentText(row.actual,row.target)}</b></span>
   <span>${hoursText(row.actual)} / ${row.target?hoursText(row.target):'目標未設定'}</span>
   ${row.target?`<small>${difference>=0?'+':'−'}${hoursText(Math.abs(difference))}</small>`:''}
  </${tag}>`;
 };
 return `<div class="achievement-panel">
  ${parent?`<button class="analysis-parent text-button" type="button" data-analysis-item="${esc(parent.id)}">‹ ${esc(parent.name)}へ戻る</button>`:''}
  <h3 tabindex="-1">${esc(item.name)}の目標別達成率</h3>
  <div class="achievement-cards">${(item.children.length?item.children:[item]).map(row=>card(row,row===item)).join('')}</div>
 </div>`;
}

export function analysisChart(state,{start,end,scope,weeks}){
 const {items,root,periods}=analysisData(state,{start,end,weeks});
 const current=items.get(scope)||root;
 const shares=periods.map(({from,to})=>completedDayShare(from,to,end));
 const dueTargets=item=>item.weekly.map(({target},index)=>target*shares[index]);
 const tone=item=>achievementTone(item.actual,item.target,dueTargets(item).reduce((sum,due)=>sum+due,0));
 return `<section class="activity-chart analysis-chart" aria-label="目標の達成度">
  <header><time datetime="${start}">${start.replaceAll('-','/')}</time><span>〜</span><time datetime="${end}">${end.replaceAll('-','/')}</time></header>
  <div class="analysis-slides" tabindex="0" aria-label="達成度。左右にスワイプ、または矢印キーで切り替え">
   <section class="analysis-slide" aria-label="推移">${trendChart(current,periods,dueTargets(current))}</section>
   <section class="analysis-slide analysis-rates" aria-label="達成率">${hierarchyChart(root,current,tone)}</section>
   <section class="analysis-slide" aria-label="目標別">${achievementCards(current,items.get(current.parentId),tone)}</section>
  </div>
  <div class="analysis-pagination" aria-hidden="true"><i></i><i></i><i></i></div>
 </section>`;
}

export function weeklyPanel(s,{week,scope,today,month,quarter=false,readOnly=false}){
 const monthly=Boolean(month),period=quarter?'3か月':monthly?'月':'週';
 const targetLabel=quarter?'月間目標の合計':monthly?'月間目標':'週間目標';
 const firstMonth=quarter?monthOffset(month,-2):month;
 const start=monthly?firstMonth+'-01':week;
 const end=monthly?shiftDate(monthOffset(month,1)+'-01',-1):shiftDate(week,6);
 const isCurrent=monthly?month===today.slice(0,7):week===weekStart(today);
 const through=end<today?end:today;
 const summary=quantitySummary(s,start,through,scope,isCurrent,monthly?'month':'week');
 let progressRows=summary.rows;
 if(quarter){
  const periodRows=new Map();
  for(let cursor=firstMonth;cursor<=month;cursor=monthOffset(cursor,1)){
   const current=cursor===today.slice(0,7);
   const monthEnd=current?today:shiftDate(monthOffset(cursor,1)+'-01',-1);
   const result=quantitySummary(s,cursor+'-01',monthEnd,scope,current,'month');
   for(const row of result.rows){
    if(!(row.target>0))continue;
    const total=periodRows.get(row.key)||{...row,amount:0,target:0};
    total.amount+=row.amount;
    total.target+=row.target;
    periodRows.set(row.key,total);
   }
  }
  progressRows=[...periodRows.values()];
  for(const row of summary.rows){
   const matched=periodRows.get(row.key);
   row.target=matched?.target??null;
   row.achievementAmount=matched?.amount;
  }
 }
 const time=summary.groups.find(group=>group.dimension==='time')?.total||0;
 const additional=summary.groups.filter(group=>group.dimension!=='time'&&group.total>0);
 const sections=weeklyTaskSections(s,summary,scope).filter(section=>section.rows.length);
 const progress=timeGoalProgress(progressRows);
 const progressTone=achievementTone(progress.actual,progress.target,progress.target*completedDayShare(start,end,today));
 const editableIds=new Set(readOnly?[]:leaves(s).map(n=>n.id));
 const goal=s.nodes.find(n=>n.id===scope)||s.nodes.find(n=>n.parentId===null);
 const short=date=>`${Number(date.slice(5,7))}/${Number(date.slice(8))}`;
 const events=Object.entries(s.logs).filter(([date])=>date>=start&&date<=through).sort(([a],[b])=>b.localeCompare(a)).flatMap(([date,logs])=>Object.entries(logs)
  .filter(([id,log])=>log.eventCompleted&&(scope==='all'||(log.goalIds||goalIds(s,id)).includes(scope)))
  .map(([id,log])=>({date,name:log.name,minutes:log.eventMinutes,quantities:log.eventQuantities||[]})));
 return `<section class="weekly-record" aria-label="${period}の記録">
  <header class="weekly-period">${readOnly?'':'<button class="week-arrow" data-quantity-period="-1" aria-label="前の期間">‹</button>'}<div><span>${start.slice(0,4)}年 · ${quarter?'3か月':'期間'}</span><h1>${monthly&&!quarter?Number(month.slice(5))+'月':`${short(start)} <i>—</i> ${short(end)}`}</h1></div>${readOnly?'':`<button class="week-arrow" data-quantity-period="1" aria-label="次の期間" ${isCurrent?'disabled':''}>›</button>`}</header>
  ${readOnly?'':`<div class="weekly-filter-row"><button class="weekly-goal-filter" data-do="choose-stats-goal"><span>表示する範囲</span><strong>${esc(goal?.name||'宇宙')}</strong><i>⌄</i></button>${!isCurrent?'<button class="text-button" data-reset-period>現在の期間へ</button>':''}</div>`}
  <section class="weekly-total-block period-overview" aria-label="目標の達成率">
   <h2>取り組んだ時間</h2>
   <div class="weekly-total-values"><div><strong>${hoursNumber(time)}</strong><span>時間</span></div></div>
   ${additional.length?`<div class="period-extra-totals">${additional.map(group=>`<span>${numberText(group.total)}${esc(group.unit)}</span>`).join('')}</div>`:''}
   <div class="period-achievement">
    <div><strong>時間目標の達成率</strong>${progress.achievement?`<div class="report-ring ${progressTone}" style="--progress:${progress.achievement.bar}%" aria-label="達成率 ${progress.achievement.percent}%"><b>${progress.achievement.percent}%</b></div>`:''}</div>
    ${progress.achievement?`<div class="weekly-task-progress-track ${progressTone}" role="progressbar" aria-label="目標全体の達成率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.achievement.bar}" aria-valuetext="${progress.achievement.percent}%"><i style="width:${progress.achievement.bar}%"></i></div>
    <p>${hoursText(progress.actual)} / ${hoursText(progress.target)} · ${progress.count}件の時間目標</p>`:`<p>この${period}の時間目標があるタスクを設定すると、達成率が表示されます。</p>`}
    ${quarter?'<p>月ごとの記録から確認できる月間目標を合算しています。</p>':''}
   </div>
  </section>
  ${recentActivity(summary,events,start,end,today)}
  <p class="weekly-source-note">期間中の記録をもとに自動で更新されます。</p>
  <details class="period-details" ${sections.length||events.length?'':'open'}>
   <summary>タスク別の内訳</summary>
   ${sections.map(section=>taskDetails(s,section,targetLabel,editableIds,start,end,today)).join('')}
   ${events.length?`<section class="weekly-goal-section"><h2><span>✧</span>完了したイベント</h2>${events.map(event=>`<div class="weekly-task-row"><strong>${esc(event.name)}</strong><span class="event-state">${short(event.date)} · 完了${event.minutes?' · '+hoursText(event.minutes/60):''}${event.quantities.map(q=>' · '+numberText(q.amount)+esc(unitInfo(q.measurement).label)).join('')}</span></div>`).join('')}</section>`:''}
   ${sections.length||events.length?'':'<p class="weekly-empty-note">この期間のタスクの記録は、まだありません。</p>'}
  </details>
  ${summary.entries.some(entry=>entry.source==='mode')?'<p class="weekly-source-note">モードから反映した固定量を含みます。</p>':''}
  ${summary.rows.some(row=>row.dimension!=='time'&&row.amount>0&&!summary.rows.some(other=>other.id===row.id&&other.dimension==='time'&&other.amount>0))?'<p class="weekly-source-note">時間の記録がない実績は、記録されている単位で表示しています。</p>':''}
  ${summary.unknown?`<p class="weekly-source-note">量が未記録のチェック ${summary.unknown}件は合計に含めていません。</p>`:''}
 </section>`;
}
export function scopeOptions(s,selected){const root=s.nodes.find(n=>n.parentId===null),out=[];function walk(n,depth){out.push(`<option value="${esc(n.id)}" ${selected===n.id?'selected':''}>${'　'.repeat(depth)}${esc(n.name)}</option>`);s.nodes.filter(c=>c.parentId===n.id).forEach(c=>walk(c,depth+1))}if(root)walk(root,0);return `<option value="all" ${selected==='all'?'selected':''}>宇宙全体</option>`+out.join('')}
