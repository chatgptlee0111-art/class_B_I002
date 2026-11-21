// Local action drafts never execute model output or write before confirmation.
const subjects = ['工程圖學','普通物理','微積分','工程力學','材料科學導論','機械製造概論','計算機程式設計','工程數學'];
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const chineseNumber = s => /^\d+$/.test(s) ? Number(s) : s==='十'?10:s.includes('十')?(Number({'二':2,'三':3}[s[0]])||1)*10+({'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9}[s.split('十')[1]]||0):({'零':0,'一':1,'二':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9}[s]??NaN);
export function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00');return !Number.isNaN(d.getTime())&&dayKey(d)===value;
}
export function parseActionRequest(text, now=new Date()) {
  if(/^(?:請問|我想知道|我該|我應該|請解釋)?(?:如何|怎麼|怎樣|為什麼|什麼)/.test(text.trim()))return null;
  const update=/(修改|更改|改成|改到|改為|移到|挪到|延到|延後|提前|調整)/.test(text);
  if(!update&&!/(新增|建立|加入|安排|排入|加一|加個|加筆)/.test(text))return null;
  const quoted=text.match(/[「“"]([^」”"]+)[」”"]/);
  // For changes, dates/times after the change verb are the destination.
  const change=text.match(/(?:修改|更改|改成|改到|改為|移到|挪到|延到|延後|提前|調整)([\s\S]*)/);
  const destination=update&&change?change[1]:text;
  let remaining=destination,date='',time='',warning='';
  let match=remaining.match(/(?:(\d{4})[年\/-])?(\d{1,2})[月\/-](\d{1,2})(?:日|號)?/);
  if(match){date=`${match[1]||now.getFullYear()}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;remaining=remaining.replace(match[0],' ');if(!validDate(date)){date='';warning='日期無效，請在草稿中選擇正確日期。'}}
  else if((match=remaining.match(/大後天|後天|明天|今天|今日/))){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+({'大後天':3,'後天':2,'明天':1,'今天':0,'今日':0}[match[0]]));date=dayKey(d);remaining=remaining.replace(match[0],' ')}
  else if((match=remaining.match(/(下下|下|本|這)?(?:週|周|星期)([一二三四五六日天])/))){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());const target='日一二三四五六'.indexOf(match[2].replace('天','日'));if(match[1]){d.setDate(d.getDate()-((d.getDay()+6)%7)+(match[1]==='下下'?14:match[1]==='下'?7:0)+((target+6)%7))}else d.setDate(d.getDate()+((target-d.getDay()+7)%7));date=dayKey(d);remaining=remaining.replace(match[0],' ')}
  if((match=remaining.match(/(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2})[:：](\d{2})/)) || (match=remaining.match(/(凌晨|早上|上午|中午|下午|晚上)?\s*([零一二兩三四五六七八九十\d]{1,3})(?:點|時)(半|[零一二三四五六七八九十\d]{1,3}分?)?/))){
    let hour=chineseNumber(match[2]);const minute=match[3]==='半'?30:match[3]?chineseNumber(match[3].replace('分','')):0;
    if(/下午|晚上/.test(match[1]||'')&&hour<12)hour+=12;
    if(match[1]==='凌晨'&&hour===12)hour=0;
    if(match[1]==='中午'&&hour>=1&&hour<=6)hour+=12;
    if(hour>=0&&hour<24&&minute>=0&&minute<60)time=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
    else warning='時間無效，請在草稿中選擇正確時間。';
    remaining=remaining.replace(match[0],' ');
  }
  if(!time&&/全天/.test(remaining))remaining=remaining.replace('全天',' ');
  const subject=subjects.find(s=>text.includes(s))||'';
  let title=quoted?.[1]||'';
  let query=title;
  if(update&&!query){query=(text.split(/改成|改到|改為|移到|挪到|延到|延後|提前/)[0]||'').replace(/^(請|麻煩|幫我|把|將|修改|更改|調整|一下)+/g,'').trim();if(query===text.trim())query=''}
  if(!update&&!title){title=remaining.replace(/^(請|麻煩|幫我|替我)+/g,'').replace(/新增|建立|加入|安排|排入|加一個|加一筆|加個|加筆/g,'').replace(/^(一個|一筆|一項|行程|活動|任務|作業|在|於|到|的|，|、|：|:|\s)+/g,'').replace(/[，。！!]+$/,'').trim()}
  const kind=/作業|任務/.test(text)?'task':'event';
  if(!update&&!date&&!warning)warning='尚未指定日期，請先補齊。';
  // Relative durations and time ranges are not guessed by the local parser.
  if(/延後|提前|小時|分鐘|到\s*(?:下午|晚上|上午|\d{1,2}[:：])/.test(destination)&&!date)warning='請確認目標日期與時間；相對時長不會自動推算。';
  return {action:update?'update':'create',query,title,date,time,allDay:/全天/.test(destination),subject,kind,warning};
}

export function initializeActionEditor({getData,save,render,toast,appendMessage,messages}){
  let draft=null;
  function element(tag,text,className){const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node}
  function showDraft(parsed){
    if(draft?.applied){appendMessage('model','上一筆變更尚未完成雲端儲存，請先在草稿卡按「重試雲端儲存」。');return}
    draft?.card.remove();
    const card=element('form',null,'ai-action-card');card.setAttribute('aria-label',parsed.action==='update'?'修改行程草稿':'新增行程草稿');
    const current={card,applied:false,before:null,target:null};draft=current;
    card.append(element('h3',parsed.action==='update'?'修改行程草稿':'新增行程草稿'));
    card.append(element('p','請確認內容後再儲存。此卡尚未修改課表。','ai-action-note'));
    const fields={};
    const field=(name,label,type='text',required=false)=>{const wrap=element('label',label);const control=element(type==='select'?'select':'input');if(type!=='select')control.type=type;control.required=required;control.setAttribute('aria-label',label);wrap.append(control);card.append(wrap);fields[name]=control;return control};
    const option=(select,value,label)=>{const o=element('option',label);o.value=value;select.append(o)};
    let targets=[];
    if(parsed.action==='update'){
      const select=field('target','選擇要修改的行程或任務','select',true);option(select,'','請選擇項目');
      targets=(getData().items||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
      for(const item of targets)option(select,item.id,`${item.date} ${item.time||'全天'} · ${item.title}`);
    }
    const title=field('title','名稱','text',true);title.maxLength=70;
    const kind=field('kind','類型','select');option(kind,'event','行程／考試');option(kind,'task','課業任務');
    const subject=field('subject','科目','select',true);option(subject,'','請選擇科目');subjects.forEach(s=>option(subject,s,s));
    const date=field('date','日期','date',true),time=field('time','時間（留空代表全天）','time');
    const note=element('p',parsed.warning||'未指定時間時，新行程會設為全天。','ai-action-note');note.setAttribute('role','status');card.append(note);
    const loadTarget=()=>{
      const item=targets.find(x=>x.id===fields.target.value);current.target=item?.id||null;current.before=item?JSON.stringify(item):null;
      title.value=item?.title||'';kind.value=item?.type||'event';subject.value=item?.subject||'';
      if(item?.subject&&!subjects.includes(item.subject))option(subject,item.subject,item.subject);
      date.value=parsed.date||item?.date||'';time.value=parsed.allDay?'':parsed.time||item?.time||'';
      note.textContent=parsed.warning||'只修改卡片中列出的欄位，原有備註與子任務會保留。提醒時間不會自動變更，必要時請至行程編輯調整。';
    };
    if(parsed.action==='update'){
      fields.target.addEventListener('change',loadTarget);
      const exact=targets.filter(x=>x.title===parsed.query),partial=parsed.query?targets.filter(x=>x.title.includes(parsed.query)):[];
      const matches=exact.length?exact:partial;
      if(matches.length===1){fields.target.value=matches[0].id;loadTarget()}
      else note.textContent=matches.length>1?'找到多筆相似項目，請先選擇要修改的那一筆。':'請先從清單選擇要修改的項目。';
    }else{title.value=parsed.title;kind.value=parsed.kind;subject.value=parsed.subject;date.value=parsed.date;time.value=parsed.time}
    const actions=element('div',null,'ai-action-buttons'),cancel=element('button','取消','secondary-btn'),submit=element('button','確認並儲存','add-btn');cancel.type='button';submit.type='submit';actions.append(cancel,submit);card.append(actions);
    cancel.addEventListener('click',()=>{if(current.applied){card.remove();draft=null;appendMessage('model','已關閉草稿。變更仍在目前畫面，請用右上方「重試儲存」完成雲端儲存。')}else{card.remove();draft=null;appendMessage('model','已取消草稿，沒有修改資料。')}});
    card.addEventListener('submit',async event=>{
      event.preventDefault();if(submit.disabled)return;
      if(!current.applied){
        if(!card.reportValidity())return;
        if(!title.value.trim()||title.value.trim().length>70||!validDate(date.value)||!subject.value){note.textContent='請填入有效的名稱、科目和日期。';return}
        const data=getData();const original=parsed.action==='update'?data.items.find(x=>x.id===fields.target.value):null;
        if(parsed.action==='update'&&(!original||JSON.stringify(original)!==current.before)){note.textContent='這筆資料已變更或刪除，請重新選擇項目並確認。';return}
        const changes={title:title.value.trim(),type:kind.value,subject:subject.value,date:date.value,time:time.value};
        if(original){Object.assign(original,changes)}
        else data.items.push({id:crypto.randomUUID(),...changes,notes:'',subtasks:[],remindAt:'',reminderEnabled:true,createdAt:Date.now()});
        current.applied=true;Object.values(fields).forEach(x=>x.disabled=true);cancel.textContent='關閉';render();
      }
      submit.disabled=true;cancel.disabled=true;submit.textContent='儲存中…';note.textContent='正在儲存至雲端…';
      try{
        if(!await save())throw Error('unsaved');
        card.remove();draft=null;render();toast('行程已儲存至雲端');appendMessage('model',`已${parsed.action==='update'?'更新':'新增'}「${title.value.trim()}」：${date.value} ${time.value||'全天'}，並儲存至雲端。`);
      }catch{note.textContent='雲端尚未儲存成功。變更已保留在目前畫面，請重試；不會重複新增。';submit.textContent='重試雲端儲存';submit.disabled=false;cancel.disabled=false}
    });
    messages.append(card);messages.scrollTop=messages.scrollHeight;
  }
  return {handleRequest(text){const parsed=parseActionRequest(text);if(!parsed)return false;if(/固定課表|固定課程|每週|每周/.test(text)){appendMessage('model','每週重複的課程請到「固定課表」新增或編輯；助理草稿目前支援單次行程與課業任務。');return true}appendMessage('model',parsed.action==='update'?'我已準備修改草稿，請選擇項目並核對新日期與時間。':'我已準備新增草稿，請確認或補齊資料後儲存。');showDraft(parsed);return true},hasUnsavedDraft:()=>!!draft?.applied,discardDraft(){if(!draft?.applied){draft?.card.remove();draft=null}}};
}
