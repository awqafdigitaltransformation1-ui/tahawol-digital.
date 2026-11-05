(() => {
 const state={token:null,profile:null,requests:[],departments:[],types:[],assignees:[],notifications:[]};
 const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const labels={new:'جديد',accepted:'مقبول',in_progress:'قيد التنفيذ',completed:'مكتمل',normal:'عادي',important:'مهم',urgent:'عاجل'};
 function msg(t,b=false){let e=$('msg');e.textContent=t;e.className='msg '+(b?'bad':'ok');setTimeout(()=>e.textContent='',4000)}
 function setScreen(n){['setup','login','employee','admin','details','catalogs','stats','notifications'].forEach(x=>$(x).classList.toggle('hidden',x!==n))}
 let auth,db,A,F,ready;
 const col=n=>F.collection(db,n), doc=(n,id)=>F.doc(db,n,id), serverTime=()=>F.serverTimestamp();
 async function setupFirebase(){
  const cfg=window.TAHAWOL_CONFIG?.FIREBASE;
  if(!cfg?.apiKey||!cfg?.projectId)throw Error('إعدادات Firebase غير مكتملة');
  const [appMod,authMod,fireMod]=await Promise.all([
   import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js'),
   import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js')]);
  A=authMod;F=fireMod;let app=appMod.initializeApp(cfg);auth=A.getAuth(app);db=F.getFirestore(app);
 }
 const iso=v=>v?.toDate?.()?.toISOString?.()||v||new Date().toISOString();
 const normalize=d=>({...d,created_at:iso(d.created_at)});
 async function api(path,opt={}){
  let method=opt.method||'GET',b=opt.body?JSON.parse(opt.body):{};
  if(path==='/login'&&method==='POST'){
   let c=await A.signInWithEmailAndPassword(auth,b.email,b.password);
   let p=await F.getDoc(doc('users',c.user.uid));
   if(!p.exists()||p.data().active!==true){await A.signOut(auth);throw Error('الحساب غير مفعل أو لا يوجد ملف مستخدم')}
   return {token:c.user.uid,profile:{id:c.user.uid,full_name:p.data().fullName||c.user.email,role:p.data().role==='admin'?'digital_transformation':'employee'}};
  }
  if(path==='/logout'){await A.signOut(auth);return {ok:true}}
  const user=auth.currentUser;if(!user)throw Error('يلزم تسجيل الدخول');
  const meDoc=await F.getDoc(doc('users',user.uid));if(!meDoc.exists()||meDoc.data().active!==true)throw Error('الحساب غير مفعل');
  const isAdmin=meDoc.data().role==='admin';
  if(path==='/me')return {id:user.uid,full_name:meDoc.data().fullName||user.email,role:isAdmin?'digital_transformation':'employee'};
  const getCollection=async(n,q)=>{let snap=await F.getDocs(q||col(n));return snap.docs.map(d=>({id:d.id,...normalize(d.data())}))};
  if(path==='/bootstrap'){
   const [requests,departments,request_types,assignees,notifications]=await Promise.all([
    getCollection('requests',isAdmin?col('requests'):F.query(col('requests'),F.where('employee_id','==',user.uid))),
    getCollection('departments'),getCollection('request_types'),getCollection('assignees'),
    getCollection('notifications',F.query(col('notifications'),F.where('user_id','==',user.uid)))
   ]);
   requests.sort((a,b)=>b.created_at.localeCompare(a.created_at));notifications.sort((a,b)=>b.created_at.localeCompare(a.created_at));
   return {requests,departments,request_types,assignees,notifications};
  }
  if(path==='/requests'&&method==='POST'){
   if(isAdmin)throw Error('الطلبات مخصصة للموظفين');
   let d=await F.getDoc(doc('departments',b.department_id)),t=await F.getDoc(doc('request_types',b.request_type_id));
   if(!d.exists()||!t.exists()||!/^\d{4}-\d{2}-\d{2}$/.test(b.requested_date))throw Error('بيانات الطلب غير صحيحة');
   let ref=F.doc(col('requests'));
   let employeeName=String(b.employee_name||'').trim();
   if(employeeName.length<2||employeeName.length>100)throw Error('يرجى إدخال اسم الموظف (من 2 إلى 100 حرف)');
   let r={employee_id:user.uid,employee_name:employeeName,department_id:d.id,department_name:d.data().name,request_type_id:t.id,request_type_name:t.data().name,requested_date:b.requested_date,description:b.description||'',status:'new',priority:'normal',needs_followup:false,assignee_id:null,assignee_name:null,created_at:serverTime(),request_no:Date.now()};
   await F.setDoc(ref,r);return {id:ref.id,...r};
  }
  let m=path.match(/^\/requests\/([^/]+)$/);
  if(m&&method==='PATCH'){
   if(!isAdmin)throw Error('غير مصرح');let ref=doc('requests',m[1]),snap=await F.getDoc(ref);if(!snap.exists())throw Error('الطلب غير موجود');
   let old=snap.data(),change={};
   if('assignee_id'in b){let a=b.assignee_id?await F.getDoc(doc('assignees',b.assignee_id)):null;change.assignee_id=a?.exists()?a.id:null;change.assignee_name=a?.exists()?a.data().name:null}
   if('priority'in b)change.priority=b.priority;
   if('needs_followup'in b)change.needs_followup=!!b.needs_followup;
   if('status'in b){change.status=b.status;}
   await F.updateDoc(ref,change);return {id:ref.id,...old,...change};
  }
  m=path.match(/^\/requests\/([^/]+)\/notes$/);
  if(m&&method==='GET')return (await getCollection('notes',F.query(col('notes'),F.where('request_id','==',m[1])))).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  if(m&&method==='POST'){if(!isAdmin)throw Error('غير مصرح');let n={request_id:m[1],author_id:user.uid,note:b.note,created_at:serverTime()};await F.addDoc(col('notes'),n);return n}
  m=path.match(/^\/catalogs\/(departments|request_types|assignees)$/);
  if(m&&method==='GET')return getCollection(m[1]);
  if(m&&method==='POST'){if(!isAdmin)throw Error('غير مصرح');let name=(b.name||'').trim();if(!name||name.length>100)throw Error('اسم غير صالح');let x=await F.addDoc(col(m[1]),{name});return {id:x.id,name}}
  m=path.match(/^\/catalogs\/(departments|request_types|assignees)\/([^/]+)$/);
  if(m&&method==='DELETE'){if(!isAdmin)throw Error('غير مصرح');await F.deleteDoc(doc(m[1],m[2]));return {ok:true}}
  m=path.match(/^\/notifications\/([^/]+)\/read$/);
  if(m){await F.updateDoc(doc('notifications',m[1]),{is_read:true});return {ok:true}}
  if(path==='/notifications/read-all'){let q=await getCollection('notifications',F.query(col('notifications'),F.where('user_id','==',user.uid)));await Promise.all(q.filter(n=>!n.is_read).map(n=>F.updateDoc(doc('notifications',n.id),{is_read:true})));return {ok:true}}
  throw Error('المسار غير موجود');
 }
 async function init(){try{await setupFirebase();A.onAuthStateChanged(auth,async user=>{try{if(user){state.profile=await api('/me');state.token=user.uid;await loadAll();renderHome()}else{state.token=null;state.profile=null;setScreen('login')}}catch(e){msg(e.message,true);setScreen('login')}})}catch(e){setScreen('setup');$('setup').textContent='تعذر تحميل Firebase: '+e.message}}
 async function login(ev){ev.preventDefault();try{let x=await api('/login',{method:'POST',body:JSON.stringify({email:$('email').value,password:$('password').value})});state.token=x.token;state.profile=x.profile;await loadAll();renderHome()}catch(e){msg(e.message,true)}}
 async function logout(){try{await api('/logout',{method:'POST'})}catch{} state.token=null;state.profile=null;setScreen('login')}
 async function loadAll(){let d=await api('/bootstrap');state.requests=d.requests;state.departments=d.departments;state.types=d.request_types;state.assignees=d.assignees;state.notifications=d.notifications;fillSelects();$('who').textContent=state.profile.full_name+' — '+(state.profile.role==='digital_transformation'?'التحول الرقمي':'موظف')}
 function fillSelects(){$('dept').innerHTML=state.departments.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');$('type').innerHTML=state.types.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}
 function card(r){return `<button class="req" onclick="V10.openRequest('${r.id}')"><span><b>#${r.request_no}</b> ${esc(r.request_type_name)}</span><span class="badge">${labels[r.status]||r.status}</span><small>${esc(r.employee_name)} • ${esc(r.department_name)} • ${r.requested_date}</small></button>`}
 function renderHome(){if(state.profile.role==='digital_transformation'){setScreen('admin');renderAdmin()}else{setScreen('employee');renderEmployee()}$('notifCount').textContent=state.notifications.filter(x=>!x.is_read).length}
 function renderEmployee(){if(!$('employeeName').value.trim())$('employeeName').value=state.profile.full_name;$('myRequests').innerHTML=state.requests.length?state.requests.map(card).join(''):'<div class="empty">لا توجد طلبات بعد</div>'}
 function renderAdmin(){let c={new:0,accepted:0,in_progress:0,completed:0};state.requests.forEach(r=>c[r.status]++);$('kpis').innerHTML=Object.entries(c).map(([k,v])=>`<div class="kpi"><b>${v}</b><span>${labels[k]}</span></div>`).join('');$('allRequests').innerHTML=state.requests.length?state.requests.map(card).join(''):'<div class="empty">لا توجد طلبات</div>'}
 async function createRequest(ev){ev.preventDefault();try{await api('/requests',{method:'POST',body:JSON.stringify({employee_name:$('employeeName').value.trim(),department_id:$('dept').value,request_type_id:$('type').value,requested_date:$('date').value,description:$('desc').value})});$('desc').value='';await loadAll();renderHome();msg('تم إرسال الطلب بنجاح')}catch(e){msg(e.message,true)}}
 async function openRequest(id){let r=state.requests.find(x=>x.id===id);if(!r)return;setScreen('details');$('detailsBody').innerHTML=`<h2>طلب #${r.request_no}</h2><div class="info"><b>الموظف</b><span>${esc(r.employee_name)}</span><b>الدائرة</b><span>${esc(r.department_name)}</span><b>نوع الطلب</b><span>${esc(r.request_type_name)}</span><b>اليوم</b><span>${r.requested_date}</span><b>الحالة</b><span>${labels[r.status]}</span><b>الأولوية</b><span>${labels[r.priority]}</span><b>المسؤول</b><span>${esc(r.assignee_name||'غير مسند')}</span></div><p>${esc(r.description||'لا يوجد وصف')}</p><div id="adminActions"></div><h3>الملاحظات</h3><div id="notes"></div>`;let notes=await api('/requests/'+id+'/notes');$('notes').innerHTML=notes.length?notes.map(n=>`<div class="note">${esc(n.note)}<small>${new Date(n.created_at).toLocaleString('ar')}</small></div>`).join(''):'<div class="empty">لا توجد ملاحظات</div>';if(state.profile.role==='digital_transformation')renderActions(r)}
 function renderActions(r){let n=r.status==='new'?['accepted','قبول الطلب']:r.status==='accepted'?['in_progress','بدء التنفيذ']:r.status==='in_progress'?['completed','إنهاء المهمة']:null;$('adminActions').innerHTML=`<div class="actiongrid">${n?`<button class="primary" onclick="V10.status('${r.id}','${n[0]}')">${n[1]}</button>`:''}<button onclick="V10.note('${r.id}')">إضافة ملاحظة</button></div><label>المسؤول عن المهمة</label><select onchange="V10.assign('${r.id}',this.value)"><option value="">غير مسند</option>${state.assignees.map(a=>`<option value="${a.id}" ${r.assignee_id===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select><label>الأولوية</label><select onchange="V10.priority('${r.id}',this.value)">${['normal','important','urgent'].map(p=>`<option value="${p}" ${r.priority===p?'selected':''}>${labels[p]}</option>`).join('')}</select><label class="check"><input type="checkbox" ${r.needs_followup?'checked':''} onchange="V10.follow('${r.id}',this.checked)"> بحاجة متابعة</label>`}
 async function patch(id,obj){try{await api('/requests/'+id,{method:'PATCH',body:JSON.stringify(obj)});await loadAll();await openRequest(id);msg('تم الحفظ')}catch(e){msg(e.message,true)}}
 async function status(id,status){await patch(id,{status})} async function assign(id,assignee_id){await patch(id,{assignee_id})} async function priority(id,priority){await patch(id,{priority})} async function follow(id,needs_followup){await patch(id,{needs_followup})}
 async function note(id){let note=prompt('اكتب الملاحظة:');if(!note?.trim())return;await api('/requests/'+id+'/notes',{method:'POST',body:JSON.stringify({note})});await openRequest(id);msg('تمت إضافة الملاحظة')}
 async function notifications(){await loadAll();setScreen('notifications');renderNotifications()} function renderNotifications(){$('notificationList').innerHTML=state.notifications.length?state.notifications.map(n=>`<button class="req" onclick="V10.openNotification('${n.id}','${n.request_id||''}')"><span><b>${esc(n.title)}</b>${n.is_read?'':' <span class="badge">جديد</span>'}</span><small>${esc(n.body)}</small></button>`).join(''):'<div class="empty">لا توجد إشعارات</div>'}
 async function openNotification(id,rid){await api('/notifications/'+id+'/read',{method:'POST'});await loadAll();if(rid)await openRequest(rid);else renderHome()} async function markAllRead(){await api('/notifications/read-all',{method:'POST'});await loadAll();renderNotifications()}
 async function catalogs(){setScreen('catalogs');renderCatalogs('departments')} async function renderCatalogs(table){let data=await api('/catalogs/'+table);$('catalogTitle').textContent=table==='departments'?'الدوائر':table==='request_types'?'أنواع الطلبات':'المسؤولون عن المهام';$('catalogList').innerHTML=data.map(x=>`<div class="cat"><span>${esc(x.name)}</span><button onclick="V10.delCat('${table}','${x.id}')">حذف</button></div>`).join('');$('catalogAdd').onclick=()=>addCat(table)}
 async function addCat(table){let name=$('catalogName').value.trim();if(!name)return;await api('/catalogs/'+table,{method:'POST',body:JSON.stringify({name})});$('catalogName').value='';await loadAll();renderCatalogs(table)} async function delCat(table,id){if(!confirm('تأكيد الحذف؟ لن تتأثر بيانات الطلبات القديمة.'))return;await api('/catalogs/'+table+'/'+id,{method:'DELETE'});await loadAll();renderCatalogs(table)}
 function stats(){setScreen('stats');let t=new Date(),f=new Date(t.getFullYear(),t.getMonth(),1);$('statsFrom').value=f.toISOString().slice(0,10);$('statsTo').value=t.toISOString().slice(0,10);renderStats()} function renderStats(){let from=$('statsFrom').value,to=$('statsTo').value,rows=state.requests.filter(r=>(!from||r.requested_date>=from)&&(!to||r.requested_date<=to)&&r.assignee_name),map={};state.assignees.forEach(a=>map[a.name]={name:a.name,total:0,completed:0,in_progress:0,accepted:0});rows.forEach(r=>{let x=map[r.assignee_name]||(map[r.assignee_name]={name:r.assignee_name,total:0,completed:0,in_progress:0,accepted:0});x.total++;if(r.status==='completed')x.completed++;if(r.status==='in_progress')x.in_progress++;if(r.status==='accepted')x.accepted++});let vals=Object.values(map).filter(x=>x.total),completed=rows.filter(r=>r.status==='completed').length,progress=rows.filter(r=>r.status==='in_progress').length,top=[...vals].sort((a,b)=>b.completed-a.completed)[0];$('statsSummary').innerHTML=`<div class="kpi"><b>${rows.length}</b><span>إجمالي المهام</span></div><div class="kpi"><b>${completed}</b><span>المكتملة</span></div><div class="kpi"><b>${progress}</b><span>قيد التنفيذ</span></div><div class="kpi"><b>${esc(top?.name||'—')}</b><span>الأكثر إنجازًا</span></div>`;$('statsList').innerHTML=vals.map(x=>`<div class="card"><h3>${esc(x.name)}</h3><div class="info"><b>إجمالي المهام</b><span>${x.total}</span><b>المكتملة</b><span>${x.completed}</span><b>قيد التنفيذ</b><span>${x.in_progress}</span><b>المقبولة</b><span>${x.accepted}</span><b>نسبة الإنجاز</b><span>${Math.round(x.completed/x.total*100)}%</span></div></div>`).join('')||'<div class="empty">لا توجد مهام ضمن الفترة</div>'}
 function back(){renderHome()}
 window.V10={init,login,logout,createRequest,openRequest,status,assign,priority,follow,note,catalogs,renderCatalogs,delCat,back,stats,renderStats,notifications,openNotification,markAllRead};document.addEventListener('DOMContentLoaded',init)
})();
