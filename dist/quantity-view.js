import {weeklyTaskSections,weeklyAchievement,timeGoalProgress} from './universe-model.js';
import {UNITS,MODES,taskLevel,modeTotals,unitInfo,quantitySummary,setting,leaves,ancestry,descendants,shiftDate,weekStart,isEventTask,eventCompletionDate,goalIds,timeMeasurement,taskRecordFields} from './model.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const numberText=n=>new Intl.NumberFormat('ja-JP',{maximumFractionDigits:3}).format(n);
function minuteInput(label,name,value='',required=true){
 return `<label>${label}<span class="task-week-target-entry"><input type="number" inputmode="decimal" name="${name}" min="0.001" max="1000000" step="any" ${required?'required':''} value="${esc(value??'')}" aria-label="${label}"><span>分</span></span></label>`;
}
function quantitySettingsFields(m){
 return `<section class="task-amount-config">
  <h3>時間の設定</h3>
  ${minuteInput('1日に取り組む時間','daily-minutes',m.dailyAmount)}
  <div class="task-weekly-target"><h3>目標時間</h3><p>週と月のどちらか、または両方を設定できます。</p>
   <div class="task-target-grid">
    ${minuteInput('1週間の目標時間','weekly-minutes',m.weeklyTarget,false)}
    ${minuteInput('1ヶ月の目標時間','monthly-minutes',m.monthlyTarget,false)}
   </div>
  </div>
 </section>`;
}
export function extraMetricFields(metric={},event=false){
 const unit=metric.unit||'';
 const amountInput=(label,field,value,required=false)=>`<label>${label}<input type="number" inputmode="decimal" name="${field}" min="0.001" max="1000000" step="any" ${required?'required':''} value="${esc(value??'')}"></label>`;
 return `<div class="extra-metric" data-extra-metric>
  <div class="extra-metric-top"><label>追加の単位<select name="extra-unit" required><option value="">選択してください</option>${Object.entries(UNITS).filter(([,u])=>u.dimension!=='time').map(([key,u])=>`<option value="${key}" ${unit===key?'selected':''}>${u.label}</option>`).join('')}<option value="custom" ${unit==='custom'?'selected':''}>自由入力</option></select></label><button type="button" class="text-button" data-remove-extra aria-label="追加の単位を削除">×</button></div>
  <label data-extra-custom ${unit==='custom'?'':'hidden'}>単位の名前<input name="extra-custom-unit" maxlength="12" value="${esc(metric.customUnit||'')}" ${unit==='custom'?'required':'disabled'}></label>
  ${amountInput('取り組む日の量','extra-daily',metric.dailyAmount,true)}
  <fieldset data-extra-targets ${event?'hidden disabled':''}><details ${metric.weeklyTarget||metric.monthlyTarget?'open':''}>
   <summary>この単位の目標（任意）</summary><div class="task-target-grid">
    ${amountInput('週間目標','extra-weekly',metric.weeklyTarget)}
    ${amountInput('月間目標','extra-monthly',metric.monthlyTarget)}
   </div>
  </details></fieldset>
 </div>`;
}
function extraRecordFields(metrics=[],amounts=[]){
 if(!metrics.length)return '';
 return `<section class="extra-record-fields"><h3>追加の記録（任意）</h3><div class="task-target-grid">
  ${metrics.map((metric,index)=>{const {label}=unitInfo(metric);return `<label>${esc(label)}<input name="record-extra" type="number" inputmode="decimal" min="0.001" max="1000000" step="any" value="${esc(amounts[index]??'')}"></label>`}).join('')}
 </div></section>`;
}
export function taskLevelFields(a,name='task-level'){const selected=taskLevel(a),options=[{value:'rest',title:'毎日取り組む',days:['rest','busy','full']},{value:'busy',title:'忙しい日も取り組む',days:['busy','full']},{value:'full',title:'余裕がある日だけ',days:['full']}];return `<fieldset class="task-schedule-config"><legend>どんな日に取り組みますか？</legend><p class="task-setting-caption">1つ選ぶと、対象の日が自動で決まります。</p><div class="task-schedule-options">${options.map(o=>`<label class="task-schedule-option"><input type="radio" required name="${esc(name)}" value="${o.value}" ${selected===o.value?'checked':''}><span class="task-schedule-copy"><strong>${o.title}</strong><span class="task-day-tags">${o.days.map(d=>`<span>${MODES[d].icon} ${MODES[d].label}</span>`).join('')}</span></span><span class="task-schedule-check" aria-hidden="true">✓</span></label>`).join('')}</div><p class="task-fixed-note">どの日も、設定した量は同じです。</p></fieldset>`}
export function taskSettingsFields(s,id){
 const action=setting(s,id),event=isEventTask(action),m=timeMeasurement(action.measurement||{unit:'minutes'});
 return `${event?`
  <input type="hidden" name="task-format" value="event">
  <label>イベントの日付（任意）<input type="date" name="event-date" value="${esc(action.eventDate||'')}"></label>
  ${minuteInput('イベントに取り組む時間','event-minutes',m.dailyAmount)}
 `:`${quantitySettingsFields(m)}${taskLevelFields(action)}`}
 <section class="task-extra-config">
  <h3>追加の記録（任意）</h3><p>ページ数、単語数、回数など、必要な単位を追加できます。</p>
  <div data-extra-list>${(m.extras||[]).filter(metric=>metric.dailyAmount!=null||metric.weeklyTarget!=null||metric.monthlyTarget!=null).map(metric=>extraMetricFields(metric,event)).join('')}</div>
  <button type="button" class="text-button add-extra-unit" data-add-extra>＋ 単位を追加</button>
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
export function presetPanel(s,id){const n=s.nodes.find(n=>n.id===id),a=setting(s,id);if(!n)return '';return `<form id="preset-form" data-id="${esc(id)}"><div class="dialog-title"><div><div class="eyebrow">${esc(ancestry(s,id).slice(1,-1).join(' / ')||'自分の宇宙')}</div><h2>${esc(n.name)}</h2></div><button type="button" class="round-button" data-do="close" aria-label="閉じる">×</button></div>${taskSettingsFields(s,id)}<div class="dialog-actions"><button type="button" class="text-button" data-edit="${esc(id)}">名前・親目標などを編集</button><button class="primary" type="submit">タスクを保存</button></div><button type="button" class="text-button record-adjust-button" data-record-leaf="${esc(id)}">${isEventTask(a)?'イベントの完了を記録':'今日の記録を調整'}</button></form>`}
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
function taskDetails(s,section,targetLabel,editableIds,end,today){
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
    const progress=weeklyAchievement(row.achievementAmount??row.amount,row.target);
    return `<div class="period-task-metric"><div><strong>${row.dimension==='time'?hoursText(row.amount):numberText(row.amount)+esc(row.unit)}</strong>
      ${progress?`<span>${targetLabel} ${row.dimension==='time'?hoursText(row.target):numberText(row.target)+esc(row.unit)} · ${progress.percent}%</span>`:''}</div>
      ${progress?`<div class="weekly-task-progress-track" role="progressbar" aria-label="${esc(task.name)}の${targetLabel}達成度（${esc(row.unit)}）" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.bar}" aria-valuetext="${progress.percent}%"><i style="width:${progress.bar}%"></i></div>`:''}
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

function radarGraphic(axes){
 const center=140,radius=104;
 const point=(index,ratio)=>{
  const angle=2*Math.PI*index/axes.length-Math.PI/2;
  return [center+Math.cos(angle)*radius*ratio,center+Math.sin(angle)*radius*ratio];
 };
 const points=ratio=>axes.map((_,index)=>point(index,ratio).join(',')).join(' ');
 const values=axes.map(({actual,target},index)=>point(index,Math.min(1,actual/target)));
 const shape=axes.length>2?'polygon':'polyline';
 return `<svg class="analysis-radar" viewBox="0 0 280 280" aria-hidden="true">
  <g class="radar-grid">${[.25,.5,.75,1].map(ratio=>axes.length>2
   ?`<polygon points="${points(ratio)}"/>`
   :`<circle cx="${center}" cy="${center}" r="${radius*ratio}"/>`).join('')}</g>
  ${axes.map((_,index)=>{
   const [x,y]=point(index,1),[labelX,labelY]=point(index,1.21);
   return `<line class="radar-axis" x1="${center}" y1="${center}" x2="${x}" y2="${y}"/>
    <text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central">${index+1}</text>`;
  }).join('')}
  ${axes.length===1?`<line class="radar-value" x1="${center}" y1="${center}" x2="${values[0][0]}" y2="${values[0][1]}"/>`:
   `<${shape} class="radar-value" points="${values.map(value=>value.join(',')).join(' ')}"/>`}
  ${values.map(([x,y])=>`<circle class="radar-point" cx="${x}" cy="${y}" r="3.5"/>`).join('')}
 </svg>`;
}

export function analysisChart(state,{start,end,scope,weeks}){
 const summary=quantitySummary(state,start,end,scope,false);
 const groups=new Map(), targets=new Map();
 const names=new Map(state.nodes.map(node=>[node.id,node.name]));
 function groupFor(id,path,fallback){
  const index=scope==='all'?1:path.indexOf(scope)+1;
  const groupId=path[index]||id;
  if(!groups.has(groupId))groups.set(groupId,{label:names.get(groupId)||fallback||'以前のタスク',actual:0,target:0,withoutTarget:0});
  return [groupId,groups.get(groupId)];
 }
 // Monthly targets are prorated by the days covered in each calendar month.
 let monthFraction=0;
 for(let month=start.slice(0,7);month<=end.slice(0,7);month=monthOffset(month,1)){
  const first=month+'-01';
  const last=shiftDate(monthOffset(month,1)+'-01',-1);
  const from=start>first?Number(start.slice(8)):1;
  const through=end<last?Number(end.slice(8)):Number(last.slice(8));
  monthFraction+=(through-from+1)/Number(last.slice(8));
 }
 for(const node of leaves(state)){
  const action=setting(state,node.id);
  if(node.kind==='goal'||isEventTask(action)||!action.measurement)continue;
  const path=goalIds(state,node.id);
  if(scope!=='all'&&!path.includes(scope))continue;
  const time=timeMeasurement(action.measurement);
  const target=(time.weeklyTarget ? time.weeklyTarget*weeks : (time.monthlyTarget||0)*monthFraction)/60;
  if(!target)continue;
  const [groupId,group]=groupFor(node.id,path,node.name);
  group.target+=target;
  targets.set(node.id,groupId);
 }
 for(const entry of summary.entries){
  if(entry.dimension!=='time'||entry.value<=0)continue;
  const index=scope==='all'?1:entry.goalIds.indexOf(scope)+1;
  const [groupId,group]=groupFor(entry.id,entry.goalIds,entry.goalPath[index]||entry.name);
  if(targets.get(entry.id)===groupId)group.actual+=entry.value;
  else group.withoutTarget+=entry.value;
 }
 for(const [date,logs] of Object.entries(state.logs)){
  if(date<start||date>end)continue;
  for(const [id,log] of Object.entries(logs)){
   if(!log.eventCompleted||!log.eventMinutes)continue;
   const path=log.goalIds||goalIds(state,id);
   if(scope!=='all'&&!path.includes(scope))continue;
   const index=scope==='all'?1:path.indexOf(scope)+1;
   const [,group]=groupFor(id,path,log.goalPath?.[index]||log.name);
   group.withoutTarget+=log.eventMinutes/60;
  }
 }
 const rows=[...groups.values()];
 const configured=rows.filter(group=>group.target>0);
 const axes=configured.slice(0,8);
 if(configured.length>8){
  const others=configured.slice(7);
  axes.splice(7,1,{
   label:'その他',actual:others.reduce((sum,row)=>sum+row.actual,0),target:others.reduce((sum,row)=>sum+row.target,0)
  });
 }
 const withoutTarget=rows.filter(group=>group.withoutTarget>0);
 const dateLabel=date=>date.split('-').map(Number).join('/');
 const additional=summary.groups.filter(group=>group.dimension!=='time'&&group.total>0);
 const row=({label,actual,target},index)=>`<li>
  ${index==null?'':`<b class="radar-key">${index+1}</b>`}<span>${esc(label)}</span>
  <span>${hoursText(actual)} / ${hoursText(target)}</span><strong>${numberText(Math.round(actual/target*100))}%</strong>
 </li>`;
 return `<section class="activity-chart analysis-chart" aria-labelledby="analysis-chart-title">
  <header><h2 id="analysis-chart-title">目標に対する達成度</h2><span>${dateLabel(start)} 〜 ${dateLabel(end)}</span></header>
  ${axes.length?`<p class="radar-caption">外周は目標時間の100%</p>
   <div class="analysis-chart-content">${radarGraphic(axes)}<ol aria-label="実績と目標時間">${axes.map(row).join('')}</ol></div>
   ${configured.length>8?`<details class="period-details"><summary>すべての項目の達成度</summary>
    <ul>${configured.map(item=>row(item,null)).join('')}</ul></details>`:''}
  `:'<p class="analysis-empty">タスクに週または月の目標時間を設定すると、達成度を表示できます。</p>'}
  ${withoutTarget.length?`<details class="period-details"><summary>達成度の計算に含まれない活動時間</summary>
   <ul>${withoutTarget.map(group=>`<li>${esc(group.label)} · ${hoursText(group.withoutTarget)}</li>`).join('')}</ul>
  </details>`:''}
  ${additional.length?`<div class="period-extra-totals">${additional.map(group=>`<span>${numberText(group.total)}${esc(group.unit)}</span>`).join('')}</div>`:''}
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
    <div><strong>時間目標の達成率</strong>${progress.achievement?`<div class="report-ring" style="--progress:${progress.achievement.bar}%" aria-label="達成率 ${progress.achievement.percent}%"><b>${progress.achievement.percent}%</b></div>`:''}</div>
    ${progress.achievement?`<div class="weekly-task-progress-track" role="progressbar" aria-label="目標全体の達成率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.achievement.bar}" aria-valuetext="${progress.achievement.percent}%"><i style="width:${progress.achievement.bar}%"></i></div>
    <p>${hoursText(progress.actual)} / ${hoursText(progress.target)} · ${progress.count}件の時間目標</p>`:`<p>この${period}の時間目標があるタスクを設定すると、達成率が表示されます。</p>`}
    ${quarter?'<p>月ごとの記録から確認できる月間目標を合算しています。</p>':''}
   </div>
  </section>
  ${recentActivity(summary,events,start,end,today)}
  <p class="weekly-source-note">期間中の記録をもとに自動で更新されます。</p>
  <details class="period-details" ${sections.length||events.length?'':'open'}>
   <summary>タスク別の内訳</summary>
   ${sections.map(section=>taskDetails(s,section,targetLabel,editableIds,end,today)).join('')}
   ${events.length?`<section class="weekly-goal-section"><h2><span>✧</span>完了したイベント</h2>${events.map(event=>`<div class="weekly-task-row"><strong>${esc(event.name)}</strong><span class="event-state">${short(event.date)} · 完了${event.minutes?' · '+hoursText(event.minutes/60):''}${event.quantities.map(q=>' · '+numberText(q.amount)+esc(unitInfo(q.measurement).label)).join('')}</span></div>`).join('')}</section>`:''}
   ${sections.length||events.length?'':'<p class="weekly-empty-note">この期間のタスクの記録は、まだありません。</p>'}
  </details>
  ${summary.entries.some(entry=>entry.source==='mode')?'<p class="weekly-source-note">モードから反映した固定量を含みます。</p>':''}
  ${summary.rows.some(row=>row.dimension!=='time'&&row.amount>0&&!summary.rows.some(other=>other.id===row.id&&other.dimension==='time'&&other.amount>0))?'<p class="weekly-source-note">時間の記録がない実績は、記録されている単位で表示しています。</p>':''}
  ${summary.unknown?`<p class="weekly-source-note">量が未記録のチェック ${summary.unknown}件は合計に含めていません。</p>`:''}
 </section>`;
}
export function scopeOptions(s,selected){const root=s.nodes.find(n=>n.parentId===null),out=[];function walk(n,depth){out.push(`<option value="${esc(n.id)}" ${selected===n.id?'selected':''}>${'　'.repeat(depth)}${esc(n.name)}</option>`);s.nodes.filter(c=>c.parentId===n.id).forEach(c=>walk(c,depth+1))}if(root)walk(root,0);return `<option value="all" ${selected==='all'?'selected':''}>宇宙全体</option>`+out.join('')}
