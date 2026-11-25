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
 function show({plan, original, choices, catalog, search, thumbnail, fullImage, locked, save}) {
  document.getElementById('sessionEditor')?.close();
  const opener = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.id = 'sessionEditor';
  dialog.setAttribute('aria-labelledby','sessionEditorTitle');
  const working = configuration(plan);
  const byId = new Map(catalog.map(row=>[row.id,row]));
  const date = original && dateFor(original);
  const scope = !original ? 'Changes apply to this active workout only.' :
   date === dateFor(null) ? 'Changes apply to today’s workout only.' :
   'Changes apply to the selected day only.';
  const make = (tag, className, label) => {
   const element = document.createElement(tag);
   element.className = className;
   if(label)element.textContent = label;
   return element;
  };
  const button = (label, action, style='button-outline') => {
   const element = make('button',style,label);
   element.type = 'button';
   element.onclick = action;
   return element;
  };
  const placeholder = './assets/image-coming-approved.webp';
  const form = make('form','session-editor-shell');
  const header = make('header','session-editor-header');
  const heading = make('h2','','');
  heading.id = 'sessionEditorTitle';
  const subtitle = make('p','','');
  const content = make('div','session-editor-scroll');
  const footer = make('footer','session-editor-footer');
  const error = make('p','session-editor-error');
  error.setAttribute('role','alert');
  const submit = make('button','button-primary',original?'Save session':'Save workout');
  submit.type = 'submit';
  const actions = make('div','session-editor-actions');
  actions.append(button('Cancel',()=>dialog.close()),submit);
  footer.append(error,actions);
  header.append(heading,subtitle);
  form.append(header,content,footer);
  dialog.append(form);
  let editorScroll = 0, saving = false;

  function showView(title, description, back) {
   header.querySelector('button')?.remove();
   if(back)header.prepend(button('‹ Back',back,'session-editor-link'));
   heading.textContent = title;
   subtitle.textContent = description;
   subtitle.hidden = !description;
   footer.hidden = !!back;
   submit.disabled = !!back || saving;
   content.replaceChildren();
   content.scrollTop = 0;
  }
  function returnToEditor() {
   renderEditor();
   content.scrollTop = editorScroll;
  }
  function showDemo(exercise, path, back) {
   showView(exercise.name,'Exercise demonstration',back);
   const image = make('img','session-editor-demo');
   image.alt = 'Full demonstration of '+exercise.name;
   image.onerror = ()=>image.replaceWith(make('p','empty-note','Demonstration unavailable.'));
   image.src = path;
   content.append(image);
   header.querySelector('button').focus();
  }
  function exerciseThumb(exercise, restore) {
   const full = exercise && fullImage(exercise);
   const frame = full ? button('',()=>showDemo(exercise,full,restore),'session-editor-thumb') :
    make('span','session-editor-thumb');
   if(full)frame.setAttribute('aria-label','View demonstration for '+exercise.name);
   const image = make('img','');
   image.src = (exercise && thumbnail(exercise)) || placeholder;
   image.alt = '';
   image.loading = 'lazy';
   image.addEventListener('error',()=>{image.src=placeholder},{once:true});
   frame.append(image);
   return frame;
  }
  function showPicker(replaceId, query='', group='', scroll=0, focusBack=true) {
   showView(replaceId?'Replace exercise':'Add exercise','Exercise library',returnToEditor);
   const filter = make('input','session-editor-search');
   filter.type = 'search';
   filter.placeholder = 'Search exercises or muscles';
   filter.setAttribute('aria-label','Search exercises');
   filter.value = query;
   const groups = make('div','session-editor-filters');
   const results = make('div','session-editor-list');
   const available = catalog.filter(e=>!working.ids.includes(e.id));
   function renderResults(){
    groups.replaceChildren();
    for(const choice of ['',...new Set(available.map(e=>e.group))]){
     const item = button(choice||'All',()=>{group=choice;renderResults();groups.querySelector('[aria-pressed="true"]').focus()},'session-editor-chip');
     item.setAttribute('aria-pressed',String(choice===group));
     groups.append(item);
    }
    const matches = search(available,filter.value,group);
    results.replaceChildren(...matches.map(exercise=>{
     const row = make('article','session-editor-card session-editor-result');
     const choose = button(exercise.name,()=>{
      if(replaceId){
       working.ids[working.ids.indexOf(replaceId)] = exercise.id;
       delete working.targets[replaceId];
      }else working.ids.push(exercise.id);
      returnToEditor();
      content.querySelector('[data-exercise="'+CSS.escape(exercise.id)+'"]')?.scrollIntoView({block:'nearest'});
     },'session-editor-choice');
     choose.append(make('small','',exercise.group));
     row.append(exerciseThumb(exercise,()=>showPicker(replaceId,filter.value,group,pickerScroll,false)),choose);
     row.firstElementChild.addEventListener('click',()=>{pickerScroll=content.scrollTop},true);
     return row;
    }));
    if(!matches.length)results.append(make('p','empty-note','No exercises match that search.'));
   }
   let pickerScroll=scroll;
   filter.oninput=renderResults;
   filter.onkeydown=event=>{if(event.key==='Enter')event.preventDefault()};
   content.append(filter,groups,results);
   renderResults();
   content.scrollTop=scroll;
   if(focusBack)header.querySelector('button').focus();
  }
  function metric(id, exercise, key, label, maximum) {
   const field = make('div','session-editor-metric');
   const caption = make('label','',label);
   const input = make('input','');
   input.id = 'session-editor-'+key+'-'+id;
   caption.htmlFor = input.id;
   input.type = 'number';
   input.inputMode = 'numeric';
   input.min = '1';
   input.max = String(maximum);
   input.step = '1';
   const initial = working.targets[id]?.[key] ?? exercise?.[key];
   input.value = Number.isInteger(initial)?String(initial):'';
   input.placeholder = String(initial ?? (key==='sets'?'3':'8–12'));
   input.setAttribute('aria-label',label+' for '+(exercise?.name||id));
   const update = () => {
    if(input.value && input.validity.valid)(working.targets[id] ||= {})[key] = Number(input.value);
    else if(input.value==='' && working.targets[id])delete working.targets[id][key];
   };
   input.oninput = update;
   const adjust = change => {
    const current = Number(input.value || input.placeholder.match(/^\d+/)?.[0] || 1);
    input.value = String(Math.min(maximum,Math.max(1,current+change)));
    update();
   };
   const stepper = make('div','session-editor-stepper');
   const minus = button('−',()=>adjust(-1));
   const plus = button('+',()=>adjust(1));
   minus.setAttribute('aria-label','Decrease '+label.toLowerCase()+' for '+(exercise?.name||id));
   plus.setAttribute('aria-label','Increase '+label.toLowerCase()+' for '+(exercise?.name||id));
   stepper.append(minus,input,plus);
   field.append(caption,stepper);
   return field;
  }
  function renderEditor() {
   showView(original?'Edit session':'Edit workout',scope);
   content.onscroll=null;
   const summary = make('div','session-editor-summary');
   summary.append(make('h3','',working.title));
   const useWorkout = next=>{
    Object.assign(working,configuration(next));
    returnToEditor();
   };
   if(original){
    const allowed = next=>[...locked].every(id=>next.ids.includes(id));
    const bar = make('div','session-editor-actions');
    const restore = button('Restore scheduled workout',()=>useWorkout(original));
    restore.disabled = !allowed(original);
    bar.append(button('Switch workout',()=>{
     editorScroll = content.scrollTop;
     showView('Switch workout','Choose a workout for this session.',returnToEditor);
     for(const choice of choices.filter(allowed))
      content.append(button(choice.title,()=>useWorkout(choice),'button-outline session-editor-workout-choice'));
     header.querySelector('button').focus();
    }),restore);
    summary.append(bar);
   }
   content.append(summary);
   const list = make('div','session-editor-list');
   let dragged = null;
   function reorder(from,to,direction) {
    if(from===to || from<0 || to<0 || to>=working.ids.length)return;
    const [id] = working.ids.splice(from,1);
    working.ids.splice(to,0,id);
    editorScroll = content.scrollTop;
    returnToEditor();
    const row = content.querySelector('[data-exercise="'+CSS.escape(id)+'"]');
    (row?.querySelector('[data-direction="'+direction+'"]:enabled') || row?.querySelector('[data-direction]:enabled'))?.focus({preventScroll:true});
    row?.scrollIntoView({block:'nearest'});
   }
   working.ids.forEach((id,index)=>{
    const exercise = byId.get(id), name = exercise?.name || id;
    const card = make('article','session-editor-card');
    card.dataset.exercise = id;
    const top = make('div','session-editor-card-head');
    const title = make('div','session-editor-card-copy');
    title.append(make('h3','',name),make('small','',exercise?.group));
    const reorderBar = make('div','session-editor-order');
    for(const [offset,direction,arrow] of [[-1,'up','↑'],[1,'down','↓']]){
     const move = button(arrow,()=>reorder(index,index+offset,direction));
     move.dataset.direction = direction;
     move.setAttribute('aria-label','Move '+name+' '+direction);
     move.disabled = index+offset<0 || index+offset>=working.ids.length;
     reorderBar.append(move);
    }
    const handle = make('span','session-editor-drag','⠿');
    handle.draggable = true;
    handle.title = 'Drag to reorder';
    handle.setAttribute('aria-hidden','true');
    handle.ondragstart = event=>{dragged=id;event.dataTransfer.setData('text/plain',id);event.dataTransfer.effectAllowed='move'};
    handle.ondragend = ()=>{dragged=null};
    card.ondragover = event=>{if(dragged)event.preventDefault()};
    card.ondrop = event=>{if(dragged){event.preventDefault();reorder(working.ids.indexOf(dragged),index,'down')}};
    reorderBar.append(handle);
    const thumb = exerciseThumb(exercise,returnToEditor);
    thumb.addEventListener('click',()=>{editorScroll=content.scrollTop},true);
    top.append(thumb,title,reorderBar);
    const targets = make('div','session-editor-targets');
    targets.append(metric(id,exercise,'sets','Sets',250),metric(id,exercise,'reps','Reps',100));
    const tools = make('div','session-editor-card-actions');
    if(locked.has(id))tools.append(make('small','','Logged sets protected'));
    else{
     const remove = button('Remove',()=>{
      working.ids.splice(index,1);
      delete working.targets[id];
      editorScroll = content.scrollTop;
      returnToEditor();
     },'session-editor-link');
     remove.disabled = working.ids.length<=1;
     tools.append(button('Replace',()=>{
      editorScroll=content.scrollTop;
      showPicker(id);
     },'session-editor-link'),remove);
    }
    card.append(top,targets,tools);
    list.append(card);
   });
   content.append(list);
   if(working.ids.length<40)content.append(button('+ Add exercise',()=>{
    editorScroll = content.scrollTop;
    showPicker(null);
   },'button-outline session-editor-add'));
  }
  form.onsubmit = async event=>{
   event.preventDefault();
   if(footer.hidden || saving)return;
   saving = submit.disabled = true;
   error.textContent = '';
   try{await save(configuration(working));dialog.close()}
   catch(e){error.textContent=e.message || 'Could not save changes.'}
   finally{saving = submit.disabled = false}
  };
  const viewport = window.visualViewport;
  const size = ()=>{
   if(!viewport)return;
   dialog.style.setProperty('--editor-height',viewport.height+'px');
   dialog.style.setProperty('--editor-top',viewport.offsetTop+'px');
  };
  dialog.addEventListener('close',()=>{
   viewport?.removeEventListener('resize',size);
   viewport?.removeEventListener('scroll',size);
   window.removeEventListener('resize',size);
   dialog.remove();
   if(opener?.isConnected)opener.focus({preventScroll:true});
  },{once:true});
  document.body.append(dialog);
  renderEditor();
  dialog.showModal();
  size();
  viewport?.addEventListener('resize',size);
  viewport?.addEventListener('scroll',size);
  window.addEventListener('resize',size);
 }
 return {dateFor,dayKey,effective,configuration,show};
})();
