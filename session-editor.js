/* A dated exception belongs to one scheduled session and one local owner. */
const SessionEditor = (() => {
 function dateFor(plan, now = new Date()) {
  const day = new Date(now);
  day.setDate(day.getDate() + (plan?.daysAhead || 0));
  return [day.getFullYear(), String(day.getMonth()+1).padStart(2,'0'), String(day.getDate()).padStart(2,'0')].join('-');
 }
 function dayKey(owner, date) {
  return 'mlc2-session-day-v1:' + (owner ? 'user:'+owner : 'guest') + ':' + date;
 }
 function configuration(plan) {
  return {title:plan.title,ids:[...plan.ids],targets:structuredClone(plan.targets || {})};
 }
 function effective(plan, owner, draft) {
  if (!plan?.ids.length) return plan;
  const date = dateFor(plan);
  if (draft?.planId === plan.id && draft.sessionDate === date)
   return {...plan,...configuration(draft),sessionDate:date};
  try {
   const raw = localStorage.getItem(dayKey(owner,date));
   const saved = raw && JSON.parse(raw);
   if(saved?.planId===plan.id && Array.isArray(saved.ids) && saved.ids.length && saved.ids.length<=40 &&
      new Set(saved.ids).size===saved.ids.length && saved.ids.every(id=>typeof id==='string') && typeof saved.title==='string')
    return {...plan,...configuration(saved),sessionDate:date};
  } catch { /* Keep the scheduled outline usable if device storage cannot be read. */ }
  return plan;
 }
 function show({plan, original, choices, catalog, locked, save}) {
  document.getElementById('sessionEditor')?.close();
  const dialog = document.createElement('dialog');
  dialog.id='sessionEditor';
  dialog.setAttribute('aria-labelledby','sessionEditorTitle');
  const working = configuration(plan);
  const byId = new Map(catalog.map(row=>[row.id,row]));
  const make = (tag,text) => {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el};
  const button = (label,action,disabled=false) => {
   const el=make('button',label);el.type='button';el.disabled=disabled;el.onclick=action;return el;
  };
  function select(label, entries, change) {
   const el=make('select');el.setAttribute('aria-label',label);
   el.add(new Option(label,''));
   for(const [id,name] of entries)el.add(new Option(name,id));
   el.onchange=()=>{if(el.value)change(el.value);el.selectedIndex=0};
   return el;
  }
  function render() {
   const heading=make('h2',original?'Edit session':'Edit workout');heading.id='sessionEditorTitle';
   const form=make('form');
   dialog.replaceChildren(heading,form);
   form.append(make('p',working.title));
   if(original){
    const allowed=p=>[...locked].every(id=>p.ids.includes(id));
    const use=p=>{Object.assign(working,configuration(p));render()};
    form.append(select('Switch workout',choices.filter(allowed).map(p=>[p.id,p.title]),id=>use(choices.find(p=>p.id===id))),
     button('Restore scheduled workout',()=>use(original),!allowed(original)));
   }
   const available=catalog.filter(e=>!working.ids.includes(e.id)).map(e=>[e.id,e.name]);
   working.ids.forEach((id,index)=>{
    const exercise=byId.get(id),row=make('fieldset');
    row.append(make('legend',exercise?.name || id));
    for(const [key,label,max] of [['sets','Sets',250],['reps','Reps',100]]){
     const field=make('label',label),input=make('input');
     input.type='number';input.inputMode='numeric';input.min='1';input.max=String(max);input.step='1';
     const value=working.targets[id]?.[key] ?? exercise?.[key];
     input.value=Number.isInteger(value)?String(value):'';input.placeholder=String(value ?? 'Default');
     input.oninput=()=>{
      const target=working.targets[id] ||= {};
      if(!input.value)delete target[key];
      else if(input.validity.valid)target[key]=Number(input.value);
     };
     field.append(input);row.append(field);
    }
    const move=offset=>{[working.ids[index],working.ids[index+offset]]=[working.ids[index+offset],id];render()};
    row.append(button('↑',()=>move(-1),index===0),button('↓',()=>move(1),index===working.ids.length-1));
    row.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-label','Move '+(exercise?.name||id)+(i?' down':' up')));
    if(locked.has(id))row.append(make('small','Logged sets saved'));
    else{
     row.append(select('Replace exercise',available,next=>{working.ids[index]=next;delete working.targets[id];render()}),
      button('Remove',()=>{working.ids.splice(index,1);delete working.targets[id];render()},working.ids.length<=1));
    }
    form.append(row);
   });
   if(working.ids.length<40)form.append(select('Add exercise',available,id=>{working.ids.push(id);render()}));
   const error=make('p');error.setAttribute('role','alert');
   const submit=make('button','Save changes');submit.type='submit';submit.className='button-primary';
   form.append(error,button('Cancel',()=>dialog.close()),submit);
   form.onsubmit=async event=>{
    event.preventDefault();submit.disabled=true;
    try{await save(configuration(working));dialog.close()}
    catch(e){error.textContent=e.message || 'Could not save changes.';submit.disabled=false}
   };
  }
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog);render();dialog.showModal();
 }
 return {dateFor,dayKey,effective,configuration,show};
})();
