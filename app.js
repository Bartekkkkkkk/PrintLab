import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash = value => Number(value || 0).toLocaleString('pl-PL',{style:'currency',currency:'PLN'});
const shortDate = value => new Date(value).toLocaleString('pl-PL',{dateStyle:'medium'});
const selected = (a,b) => String(a??'')===String(b??'')?'selected':'';
const checked = v => v?'checked':'';
// Tłumaczenie komunikatów dostawców zewnętrznych. Szczegóły techniczne pozostają w konsoli.
function niceError(error){
  const raw=String(error?.message||error?.error_description||error?.error||error||'').trim();
  if(!raw)return 'Wystąpił błąd. Spróbuj ponownie.';
  const code=String(error?.code||error?.status||'').toLowerCase();
  const translations=[
    [/invalid login credentials|invalid credentials|email or password is incorrect|invalid email or password/i,'Nieprawidłowy adres e-mail lub hasło.'],
    [/email not confirmed|email_not_confirmed/i,'Potwierdź adres e-mail, aby się zalogować.'],
    [/user already registered|already been registered|email address is already registered|user_already_exists/i,'Użytkownik z tym adresem e-mail już istnieje.'],
    [/password should be at least|password must be at least|weak password/i,'Hasło jest za krótkie lub zbyt słabe.'],
    [/password.*different|new password should be different/i,'Nowe hasło musi różnić się od poprzedniego.'],
    [/signup is disabled|signups? not allowed/i,'Rejestracja jest obecnie wyłączona.'],
    [/email rate limit exceeded|too many emails|email.*rate limit/i,'Przekroczono limit wiadomości e-mail. Spróbuj ponownie później.'],
    [/too many requests|rate limit exceeded|for security purposes.*seconds|over_request_rate_limit/i,'Zbyt wiele prób. Spróbuj ponownie za chwilę.'],
    [/invalid email|email address is invalid/i,'Podaj poprawny adres e-mail.'],
    [/auth session missing|session.*expired|jwt expired|refresh token.*invalid|invalid refresh token/i,'Sesja wygasła. Zaloguj się ponownie.'],
    [/duplicate key value violates unique constraint|23505|already exists/i,'Taki wpis już istnieje. Zmień nazwę lub spróbuj ponownie.'],
    [/violates foreign key constraint|23503|foreign key constraint/i,'Nie można wykonać operacji z powodu powiązanych danych.'],
    [/violates not-null constraint|23502|null value in column/i,'Uzupełnij wymagane pola formularza.'],
    [/violates check constraint|23514|check constraint/i,'Podane dane nie spełniają wymagań formularza.'],
    [/row.level security|permission denied|not authorized|unauthorized|forbidden|42501|insufficient_privilege/i,'Nie masz uprawnień do wykonania tej operacji.'],
    [/invalid input syntax for type uuid|22p02/i,'Nieprawidłowy identyfikator rekordu.'],
    [/failed to fetch|network request failed|networkerror|load failed|fetch failed|connection.*lost|ERR_NETWORK/i,'Brak połączenia z serwerem. Sprawdź Internet i spróbuj ponownie.'],
    [/storage.*limit|payload too large|entity too large|file too large/i,'Plik jest za duży. Wybierz mniejszy plik.'],
    [/bucket not found|storage bucket not found/i,'Nie znaleziono miejsca przechowywania zdjęć.'],
    [/invalid.*payment|payment.*failed|payment_intent|checkout.session|stripe/i,'Wystąpił problem z płatnością. Spróbuj ponownie.'],
    [/unexpected token|invalid json|internal server error|bad gateway|service unavailable|gateway timeout/i,'Serwer jest chwilowo niedostępny. Spróbuj ponownie później.'],
    [/no rows found|pgrst116|cannot coerce.*single json/i,'Nie znaleziono wskazanego rekordu.'],
  ];
  for(const [pattern,message] of translations)if(pattern.test(raw)||pattern.test(code))return message;
  // Własne komunikaty aplikacji są polskie; angielskich błędów dostawców nie wyświetlamy.
  if(/^(Nie |Brak |Podaj |Wpisz |Zaloguj |Wyloguj |Wystąpił |Przekrocz|Zbyt |Sesja |Dostęp |Kategoria |Produkt |Wariant |Plik |Błęd|Cena |Płatność |Konto |Wybierz |Zapisano |Nieprawidłow|Przed |Uzupełnij |Ten |Ta |To |Niedozwolon|Odmowa |Proszę |Oczekiwanie |Wyłączon|Możesz |Adres |Przesyłk|Przywróc|Podczas |Nie udało)/i.test(raw))return raw;
  return 'Nie udało się wykonać operacji. Spróbuj ponownie.';
}
const statusLabels={
  new:'Nowe',pending_payment:'Oczekuje na płatność',pending:'Oczekuje',
  unpaid:'Nieopłacone',paid:'Opłacone',in_production:'W przygotowaniu',
  processing:'W realizacji',shipped:'Wysłane',delivered:'Dostarczone',
  cancelled:'Anulowane',canceled:'Anulowane',refunded:'Zwrócone',
  failed:'Nieudane',succeeded:'Zakończone',completed:'Zakończone',
};
const polishStatus=value=>statusLabels[String(value||'').toLowerCase()]||'Nieznany status';
const configured = /^https:\/\/[^\s]+\.supabase\.co\/?$/.test(SUPABASE_URL.trim()) && SUPABASE_ANON_KEY.length > 30 && !SUPABASE_ANON_KEY.includes('WPISZ');
let sb = null, user = null, profile = null, isAdmin = false;
let categories = [], products = [], variants = [], orders = [], customers = [];
let currentPage = 'shop', adminTab = 'categories', categoryFilter = 'all', subcategoryFilter = 'all';
let cart = safeCart();
// Losowanie następuje przy wejściu na stronę, a nie przy każdym filtrowaniu.
let featuredIds = [];
let featuredSignature = null;
function pickHeroProducts(){
  const available = products.filter(p=>p.is_active && cleanUrl(p.image_url));
  // Produkt bez zdjęcia nie zajmuje miejsca w sekcji promowanej.
  const signature = available.map(p=>p.id).sort().join('|');
  if(signature !== featuredSignature){
    featuredSignature = signature;
    const pool = available.slice();
    // Fisher-Yates z losowością przeglądarki; każde otwarcie to inna próba losowania.
    for(let i=pool.length-1;i>0;i--){
      const random = new Uint32Array(1);crypto.getRandomValues(random);
      const j=random[0]%(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];
    }
    featuredIds=pool.slice(0,3).map(p=>p.id);
  }
}
function renderHeroProducts(){
  const hero=$('heroFeatured');if(!hero)return;
  const items=featuredIds.map(id=>products.find(p=>p.id===id)).filter(Boolean);
  if(!items.length){
    hero.innerHTML='<div class="featured-empty">Tutaj pojawią się produkty ze zdjęciami dodane w panelu administratora.</div>';
    return;
  }
  hero.innerHTML=`<div class="featured-grid">${items.map((p,i)=>`<button type="button" class="featured-tile" data-featured-product="${escapeHTML(p.id)}" aria-label="Zobacz produkt: ${escapeHTML(p.name)}"><img src="${escapeHTML(cleanUrl(p.image_url))}" alt="${escapeHTML(p.name)}" ${i?'loading="lazy"':'fetchpriority="high"'}><span class="featured-name">${escapeHTML(p.name)}</span></button>`).join('')}</div>`;
}

function safeCart(){try{return JSON.parse(localStorage.getItem('printlab-cart-v2')||'[]').filter(i=>i.id&&i.variantId&&i.qty>0)}catch{return []}}
function saveCart(){localStorage.setItem('printlab-cart-v2',JSON.stringify(cart));updateCartCount()}
function notify(msg){$('toast').textContent=msg;$('toast').classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').classList.remove('visible'),3500)}
function fail(error){console.error(error);notify(niceError(error))}
function setLoading(button,loading){button.disabled=loading;button.dataset.original ??= button.textContent;button.textContent=loading?'Zapisywanie…':button.dataset.original}
function categoryName(id){return categories.find(c=>c.id===id)?.name||'Bez kategorii'}
function productName(id){return products.find(p=>p.id===id)?.name||'Produkt'}
function variantName(id){return variants.find(v=>v.id===id)?.name||'Wariant'}
function defaultSlug(name){return String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)+'-'+crypto.randomUUID().slice(0,8)}
function cleanUrl(u){let t=String(u||'').trim();try{let x=new URL(t);return ['https:','http:'].includes(x.protocol)?x.href:''}catch{return ''}}
function backdrop(show){$('screenOverlay').classList.toggle('hidden',!show)}
function modal(html){$('modalBody').innerHTML=html;$('modalWrap').classList.remove('hidden');backdrop(true);document.body.style.overflow='hidden'}
function closeModal(){$('modalWrap').classList.add('hidden');$('cartDrawer').classList.add('hidden');backdrop(false);document.body.style.overflow=''}
function showPage(page){
  if(page==='admin'&&!isAdmin){notify('Brak uprawnień administratora.');return}
  if(page==='orders'&&!user){showAuth();return}
  currentPage=page;['shop','admin','orders'].forEach(p=>$(p+'View').classList.toggle('hidden',p!==page));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.id===({shop:'goShop',admin:'goAdmin',orders:'goOrders'}[page])));
  $('mobileMenu').classList.add('hidden');$('mobileNavButton').setAttribute('aria-expanded','false');
  if(page==='admin')renderAdmin();if(page==='orders')loadOrders();
  window.scrollTo({top:0,behavior:'smooth'});
}
function updateAuthUI(){
  // Zamówienia widoczne dopiero po potwierdzeniu aktywnej sesji.
  $('goOrders').classList.toggle('hidden', !user);
  $('mobileOrders').classList.toggle('hidden', !user);
  if (!user && currentPage === 'orders') showPage('shop');
  document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!isAdmin));
  $('authButton').textContent=user?'Wyloguj':'Zaloguj się';
}
async function loadCatalog(){
  if(!sb){renderHeroProducts();renderCatalog();return}
  const [c,p,v]=await Promise.all([
    sb.from('categories').select('*').order('position').order('name'),
    sb.from('products').select('*').order('created_at',{ascending:false}),
    sb.from('product_variants').select('*').order('created_at')
  ]);
  for(const r of [c,p,v])if(r.error)throw r.error;
  categories=c.data||[];products=p.data||[];variants=v.data||[];
  pickHeroProducts();renderHeroProducts();renderCatalog();if(currentPage==='admin')renderAdmin();
}
function categoriesDescendant(id){return categories.filter(c=>c.parent_id===id).map(c=>c.id)}
function renderCatalog(){
  const visibleCats=categories.filter(c=>c.is_active&&(!c.parent_id));
  $('categoryBar').innerHTML=`<button type="button" class="category-chip ${categoryFilter==='all'?'chosen':''}" data-cat="all">Wszystkie</button>`+
    visibleCats.map(c=>`<button type="button" class="category-chip ${categoryFilter===c.id?'chosen':''}" data-cat="${c.id}">${escapeHTML(c.name)}</button>`).join('');
  const children=categories.filter(c=>c.parent_id===categoryFilter&&c.is_active);
  $('subcategoryBar').classList.toggle('hidden',!children.length);
  $('subcategoryBar').innerHTML=`<button type="button" class="subchip ${subcategoryFilter==='all'?'chosen':''}" data-subcat="all">Wszystkie</button>`+
    children.map(c=>`<button type="button" class="subchip ${subcategoryFilter===c.id?'chosen':''}" data-subcat="${c.id}">${escapeHTML(c.name)}</button>`).join('');
  let list=products.filter(p=>p.is_active && (categoryFilter==='all' || (subcategoryFilter!=='all'?p.category_id===subcategoryFilter:[categoryFilter,...categoriesDescendant(categoryFilter)].includes(p.category_id))));
  const q=$('searchProducts').value.trim().toLowerCase();
  if(q)list=list.filter(p=>(p.name+' '+p.description+' '+categoryName(p.category_id)).toLowerCase().includes(q));
  const lowest=p=>{const prices=variants.filter(v=>v.product_id===p.id&&v.is_active).map(v=>Number(v.price));return prices.length?Math.min(...prices):Number(p.base_price)};
  const sort=$('sortProducts').value;
  if(sort==='priceUp')list.sort((a,b)=>lowest(a)-lowest(b));
  if(sort==='priceDown')list.sort((a,b)=>lowest(b)-lowest(a));
  if(sort==='alpha')list.sort((a,b)=>a.name.localeCompare(b.name,'pl'));
  $('productCounter').textContent=`${list.length} produktów`;
  $('emptyCatalog').classList.toggle('hidden',!!list.length);
  $('productGrid').innerHTML=list.map(p=>{
    const vs=variants.filter(v=>v.product_id===p.id&&v.is_active);
    const price=vs.length?Math.min(...vs.map(v=>Number(v.price))):Number(p.base_price);
    return `<article class="product-card"><div class="product-photo">${cleanUrl(p.image_url)?`<img src="${escapeHTML(cleanUrl(p.image_url))}" loading="lazy" alt="${escapeHTML(p.name)}">`:`<span class="placeholder-product">PL<span>.</span></span>`}</div>
      <div class="product-details"><span class="product-category-label">${escapeHTML(categoryName(p.category_id))}</span><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description||'Produkt PrintLab — druk 3D.').slice(0,160)}</p>
      <p class="lead-time">Czas realizacji: 2 dni robocze</p><div class="product-bottom"><span class="product-price">${vs.length>1?'od ':''}${cash(price)}</span><button type="button" class="small-button" data-view-product="${p.id}">Zobacz</button></div></div></article>`;
  }).join('');
  if(!configured){
    $('productGrid').innerHTML='';$('emptyCatalog').classList.add('hidden');
    if(!$('setupNote')){
      const message=document.createElement('div');message.className='config-warning';message.id='setupNote';
      message.innerHTML='<strong>Podłącz Supabase, aby uruchomić katalog.</strong><br>Uzupełnij <code>config.js</code> oraz wykonaj skrypt <code>supabase/schema.sql</code>. Wszystkie dane będą później pobierane bezpośrednio z bazy.';
      $('productGrid').before(message);
    }
  }else $('setupNote')?.remove();
}
async function refreshAuth(){
  if(!sb)return;
  const {data:{user:current},error}=await sb.auth.getUser();if(error)console.warn('Auth:',error.message);
  user=current;isAdmin=false;profile=null;
  if(user){
    const [a,p]=await Promise.all([sb.from('admins').select('user_id').eq('user_id',user.id).maybeSingle(),sb.from('profiles').select('*').eq('id',user.id).maybeSingle()]);
    if(a.error)console.warn(a.error);if(p.error)console.warn(p.error);
    isAdmin=!!a.data;profile=p.data;
  }
  updateAuthUI();await loadCatalog();
  if(currentPage==='admin'&&!isAdmin)showPage('shop');
}
function productionRedirect(){
  const url = new URL(window.location.href);
  // Linki mailowe nie mogą kierować na testowy serwer localhost.
  if (['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname) || url.protocol !== 'https:') {
    throw new Error('Linki weryfikacyjne wysyłaj po uruchomieniu sklepu na HTTPS (Vercel). Ustaw też Site URL w Supabase → Authentication → URL Configuration.');
  }
  return url.origin + url.pathname;
}
function showNewPasswordModal(){
  modal(`<div class="eyebrow"><span class="dot"></span> PRINTLAB / BEZPIECZEŃSTWO</div><h2 id="modalTitle">Ustaw nowe hasło</h2><p class="modal-desc">Podaj nowe hasło do swojego konta PrintLab.</p><form id="newPasswordForm" class="form-grid"><div class="field span2"><label for="newPassword">Nowe hasło</label><input id="newPassword" type="password" minlength="8" required autocomplete="new-password"></div><div class="field span2"><label for="confirmPassword">Powtórz hasło</label><input id="confirmPassword" type="password" minlength="8" required autocomplete="new-password"></div><div class="field span2"><button type="submit" class="primary-btn full">Zapisz nowe hasło</button></div></form>`);
  $('newPasswordForm').onsubmit = async e => {
    e.preventDefault(); const pass=$('newPassword').value;
    if (pass!==$('confirmPassword').value){notify('Hasła nie są identyczne.');return;}
    const button=e.target.querySelector('[type=submit]'); setLoading(button,true);
    try {const {error}=await sb.auth.updateUser({password:pass}); if(error)throw error;closeModal();notify('Hasło zostało zmienione.');history.replaceState({},'',location.pathname);}
    catch(error){fail(error)}finally{setLoading(button,false)}
  };
}
function showAuth(mode='login'){
  if(!sb){notify('Najpierw skonfiguruj Supabase w pliku config.js.');return}
  const isRegister=mode==='register',isReset=mode==='reset';
  modal(`<h2 id="modalTitle">${isReset?'Resetowanie hasła':isRegister?'Utwórz konto':'Witaj w PrintLab'}</h2><p class="modal-desc">${isReset?'Otrzymasz wiadomość z linkiem do ustawienia nowego hasła.':isRegister?'Zarejestruj się, aby mieć konto klienta.':'Zaloguj się do swojego konta.'}</p>
    <form id="authForm" class="form-grid">${isRegister?'<div class="field span2"><label for="fullName">Imię / nazwa użytkownika</label><input id="fullName" maxlength="100" autocomplete="name"></div>':''}
      <div class="field span2"><label for="loginEmail">E-mail</label><input id="loginEmail" type="email" required autocomplete="email"></div>
      ${isReset?'':`<div class="field span2"><label for="loginPassword">Hasło</label><input id="loginPassword" type="password" minlength="8" required autocomplete="${isRegister?'new-password':'current-password'}"></div>`}
      <div class="field span2"><button type="submit" class="primary-btn full">${isReset?'Wyślij link':isRegister?'Zarejestruj':'Zaloguj'}</button></div></form>
    <div class="auth-options">${isRegister?'<button type="button" id="switchToLogin">Mam już konto</button>':isReset?'<button type="button" id="switchToLogin">Wróć do logowania</button>':'<button type="button" id="switchToRegister">Zarejestruj się</button> · <button type="button" id="switchToReset">Nie pamiętam hasła</button>'}</div>`);
  $('authForm').addEventListener('submit',async e=>{
    e.preventDefault();const b=e.target.querySelector('[type=submit]');setLoading(b,true);
    const email=$('loginEmail').value.trim(),password=$('loginPassword')?.value;
    try{
      let result;
      if(isRegister)result=await sb.auth.signUp({email,password,options:{emailRedirectTo:productionRedirect(),data:{display_name:$('fullName').value.trim()}}});
      else if(isReset)result=await sb.auth.resetPasswordForEmail(email,{redirectTo:productionRedirect()});
      else result=await sb.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      closeModal();notify(isRegister?'Sprawdź skrzynkę e-mail, jeśli wymagane jest potwierdzenie.':isReset?'Sprawdź pocztę e-mail.':'Zalogowano.');
      await refreshAuth();
    }catch(err){fail(err)}finally{setLoading(b,false)}
  });
  $('switchToLogin')?.addEventListener('click',()=>showAuth('login'));
  $('switchToRegister')?.addEventListener('click',()=>showAuth('register'));
  $('switchToReset')?.addEventListener('click',()=>showAuth('reset'));
}
async function showAccountMenu(){
  if(!user){showAuth();return}
  if(!sb)return;
  const {error}=await sb.auth.signOut();
  if(error){fail(error);return}
  user=null;isAdmin=false;profile=null;
  updateAuthUI();showPage('shop');await loadCatalog();notify('Wylogowano.');
}
function productModal(productId){
  const p=products.find(x=>x.id===productId);if(!p)return;
  const vs=variants.filter(v=>v.product_id===p.id&&v.is_active);
  modal(`<span class="section-kicker">${escapeHTML(categoryName(p.category_id))}</span><h2 id="modalTitle">${escapeHTML(p.name)}</h2>
  <div class="product-modal-pic" id="modalProductPic">${cleanUrl(p.image_url)?`<img src="${escapeHTML(cleanUrl(p.image_url))}" alt="${escapeHTML(p.name)}">`:'<span class="placeholder-product">PL<span>.</span></span>'}</div>
  <p class="modal-desc">${escapeHTML(p.description||'Produkt PrintLab.')}</p><p class="lead-time">Czas realizacji: 2 dni robocze</p>
  ${vs.length?`<div class="variant-choice"><label for="variantPicker">Wybierz wariant / podprodukt</label><select id="variantPicker">${vs.map(v=>`<option value="${v.id}">${escapeHTML(v.name)}${v.color?' — '+escapeHTML(v.color):''}${v.size?' / '+escapeHTML(v.size):''} · ${cash(v.price)}</option>`).join('')}</select><p id="variantFulfillment" class="subtle"></p></div><button type="button" id="addVariantToCart" class="primary-btn full">Dodaj do koszyka</button>`:'<div class="empty-hint">Ten produkt nie ma jeszcze dostępnych wariantów.</div>'}`);
  if(!vs.length)return;
  const picker=$('variantPicker');picker.value=vs[0].id;
  const update=()=>{
    const v=vs.find(x=>x.id===picker.value);if(!v)return;
    $('variantFulfillment').textContent=`Cena: ${cash(v.price)} · Czas realizacji: 2 dni robocze`;

    const img=cleanUrl(v.image_url)||cleanUrl(p.image_url);
    $('modalProductPic').innerHTML=img?`<img src="${escapeHTML(img)}" alt="${escapeHTML(p.name)}">`:'<span class="placeholder-product">PL<span>.</span></span>';
  };
  picker.addEventListener('change',update);update();
  $('addVariantToCart').addEventListener('click',()=>{addToCart(p.id,picker.value);closeModal()});
}
function addToCart(productId,variantId){
  const v=variants.find(x=>x.id===variantId&&x.product_id===productId);
  if(!v||!v.is_active){notify('Ten wariant jest niedostępny.');return}
  const row=cart.find(i=>i.id===productId&&i.variantId===variantId);
  if(row){if(row.qty>=20){notify('Maksymalnie 20 szt. wariantu w jednym zamówieniu.');return}row.qty++}else cart.push({id:productId,variantId,qty:1});
  saveCart();notify('Dodano do koszyka.');
}
function updateCartCount(){let n=cart.reduce((sum,x)=>sum+x.qty,0);$('cartCount').textContent=`(${n})`;$('drawerCount').textContent=`(${n})`}
function openCart(){$('cartDrawer').classList.remove('hidden');backdrop(true);document.body.style.overflow='hidden';renderCart()}
function renderCart(){
  cart=cart.filter(i=>products.some(p=>p.id===i.id)&&variants.some(v=>v.id===i.variantId));saveCart();
  $('cartItems').innerHTML=cart.length?cart.map(i=>{const v=variants.find(x=>x.id===i.variantId);return `<div class="cart-line"><div><strong>${escapeHTML(productName(i.id))}</strong><small>${escapeHTML(v.name)} · ${cash(v.price)} / szt.</small><div class="qty-box"><button data-cart-qty="${v.id}" data-change="-1">−</button><span>${i.qty}</span><button data-cart-qty="${v.id}" data-change="1">+</button><button class="remove" data-cart-remove="${v.id}">Usuń</button></div></div><strong>${cash(Number(v.price)*i.qty)}</strong></div>`}).join(''):'<div class="empty-state"><h3>Koszyk jest pusty</h3><p>Dodaj produkt z katalogu.</p></div>';
  $('cartTotal').textContent=cash(cart.reduce((s,i)=>s+Number(variants.find(v=>v.id===i.variantId)?.price||0)*i.qty,0));
}
// Płatność uruchamiana wyłącznie przez serwer Vercel.
async function openCheckout(){
 if(!sb||!user){notify('Zaloguj się, aby złożyć zamówienie.');showAuth();return}
 if(!cart.length){notify('Koszyk jest pusty.');return}
 closeModal();
 modal(`<h2 id="modalTitle">Dostawa i płatność</h2><p class="subtle">Dostawa wyłącznie kurierem InPost pod wskazany adres. Przesyłkę nadamy ręcznie po opłaceniu zamówienia. Cenę produktów weryfikuje serwer.</p>
  <form id="inpostCheckoutForm" class="form-grid">
    <div class="field span2"><label>Imię i nazwisko odbiorcy *</label><input name="recipient" maxlength="120" required autocomplete="name" placeholder="Jan Kowalski"></div>
    <div class="field span2"><label>Telefon odbiorcy *</label><input name="phone" type="tel" required placeholder="500 600 700" autocomplete="tel"></div>
    <div class="field span2"><label>E-mail odbiorcy *</label><input name="recipient_email" type="email" required maxlength="254" autocomplete="email" placeholder="np. jan@example.com"><small>Na ten adres wyślemy potwierdzenie zamówienia po opłaceniu.</small></div>
    <div class="field span2"><label>Ulica i numer domu *</label><input name="street" required maxlength="160" autocomplete="address-line1" placeholder="np. Warszawska 12"></div>
    <div class="field span2"><label>Numer lokalu (opcjonalnie)</label><input name="apartment" maxlength="32" autocomplete="address-line2" placeholder="np. 5"></div>
    <div class="field"><label>Kod pocztowy *</label><input name="postal_code" required inputmode="numeric" pattern="[0-9]{2}-[0-9]{3}" maxlength="6" autocomplete="postal-code" placeholder="00-001"></div>
    <div class="field"><label>Miejscowość *</label><input name="city" required maxlength="90" autocomplete="address-level2" placeholder="np. Warszawa"></div>
    <div class="field span2"><small>Metoda dostawy: InPost Kurier</small></div>
    <div class="field span2"><p class="subtle" id="checkoutNote">Koszt dostawy i ostateczna kwota zostaną wyświetlone również na stronie płatności.</p></div>
    <div class="field span2"><button class="primary-btn full" type="submit">Przejdź do bezpiecznej płatności →</button></div>
  </form>`);
 $('inpostCheckoutForm').onsubmit=async e=>{
   e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type=submit]');if(!form.reportValidity())return;
   button.disabled=true;button.textContent='Przekierowywanie…';
   try{
    const {data:{session}}=await sb.auth.getSession();if(!session?.access_token)throw Error('Zaloguj się ponownie.');
    const body={items:cart.map(i=>({variantId:i.variantId,qty:i.qty})),address:{street:form.elements.namedItem('street').value,apartment:form.elements.namedItem('apartment').value,postal_code:form.elements.namedItem('postal_code').value,city:form.elements.namedItem('city').value,country:'PL'},recipient:form.elements.namedItem('recipient').value,phone:form.elements.namedItem('phone').value,recipientEmail:form.elements.namedItem('recipient_email').value};
    const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Błąd płatności');
    if(!result.url||!result.url.startsWith('https://checkout.stripe.com/'))throw Error('Nieprawidłowy adres płatności.');
    location.assign(result.url);
   }catch(err){fail(err);button.disabled=false;button.textContent='Przejdź do bezpiecznej płatności →';}
 };
}

async function loadOrders(){
  if(!sb||!user){$('ordersContent').innerHTML='<p>Zaloguj się, aby zobaczyć zamówienia.</p>';return}
  const {data,error}=await sb.from('checkout_orders').select('id,status,payment_status,total,created_at,inpost_tracking').eq('user_id',user.id).eq('payment_status','paid').order('created_at',{ascending:false});
  if(error){fail(error);return}
  $('ordersContent').innerHTML=data.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Numer</th><th>Data</th><th>Status</th><th>Płatność</th><th>Kwota</th><th>InPost</th></tr></thead><tbody>${data.map(o=>`<tr><td>${escapeHTML(o.id.slice(0,8))}</td><td>${shortDate(o.created_at)}</td><td>${escapeHTML(polishStatus(o.status))}</td><td>${escapeHTML(polishStatus(o.payment_status))}</td><td>${cash(o.total)}</td><td>${escapeHTML(o.inpost_tracking||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state" style="margin:0"><h3>Brak zamówień</h3><p>Tutaj pojawią się wyłącznie zamówienia z potwierdzoną płatnością.</p></div>';
}
// --- Panel administratora: wszystkie zapisy wykonuje Supabase i egzekwuje RLS. ---
function ensureAdmin(){if(!sb||!isAdmin)throw new Error('Nie masz uprawnień administratora.')}
function selectOptions(rows,value='',placeholder='Wybierz…'){
  return `<option value="">${escapeHTML(placeholder)}</option>`+rows.map(r=>`<option value="${r.id}" ${selected(r.id,value)}>${escapeHTML(r.label||r.name)}</option>`).join('');
}
function headRow(title,actionLabel,action){return `<div class="admin-topline"><h2>${title}</h2>${actionLabel?`<button type="button" class="primary-btn" data-admin-action="${action}">+ ${actionLabel}</button>`:''}</div>`}
function renderAdmin(){
  if(!isAdmin)return;
  [...$('adminTabs').children].forEach(b=>b.classList.toggle('selected',b.dataset.tab===adminTab));
  const target=$('adminContent');
  if(adminTab==='categories'){
    const rows=categories.slice().sort((a,b)=>(a.parent_id?1:0)-(b.parent_id?1:0)||a.position-b.position||a.name.localeCompare(b.name));
    target.innerHTML=headRow('Kategorie i podkategorie','Dodaj kategorię','category-add')+
      `<div class="table-scroll"><table class="data-table"><thead><tr><th>Nazwa</th><th>Typ</th><th>Status</th><th>Kolejność</th><th>Akcje</th></tr></thead><tbody>${rows.map(c=>`<tr><td><strong>${c.parent_id?'↳ ':''}${escapeHTML(c.name)}</strong></td><td class="muted">${c.parent_id?'Podkategoria · '+escapeHTML(categoryName(c.parent_id)):'Kategoria główna'}</td><td><span class="status ${c.is_active?'':'off'}">${c.is_active?'Aktywna':'Ukryta'}</span></td><td>${c.position}</td><td class="actions"><button data-admin-action="category-edit" data-id="${c.id}">Edytuj</button><button type="button" data-admin-action="category-delete" data-id="${c.id}" title="Usuń kategorię; produkty pozostaną w sklepie">Usuń</button></td></tr>`).join('')}</tbody></table></div>`;
  }else if(adminTab==='products'){
    target.innerHTML=headRow('Produkty','Dodaj produkt','product-add')+
      `<div class="table-scroll"><table class="data-table"><thead><tr><th>Produkt</th><th>Kategoria</th><th>Cena bazowa</th><th>Status</th><th>Akcje</th></tr></thead><tbody>${products.map(p=>`<tr><td><strong>${escapeHTML(p.name)}</strong></td><td>${escapeHTML(categoryName(p.category_id))}</td><td>${cash(p.base_price)}</td><td><span class="status ${p.is_active?'':'off'}">${p.is_active?'Widoczny':'Ukryty'}</span></td><td class="actions"><button data-admin-action="product-edit" data-id="${p.id}">Edytuj</button><button data-admin-action="product-variants" data-id="${p.id}">Warianty</button><button type="button" data-admin-action="product-delete" data-id="${p.id}" title="Usuń produkt natychmiast, bez potwierdzenia" aria-label="Usuń produkt ${escapeHTML(p.name)} natychmiast">Usuń</button></td></tr>`).join('')}</tbody></table></div>`;
  }else if(adminTab==='variants'){
    target.innerHTML=headRow('Warianty',products.length?'Dodaj wariant':'','variant-add')+
      `<p class="subtle">Wariant posiada własny kolor, rozmiar, cenę i opcjonalne zdjęcie. Jeden produkt może mieć dowolną liczbę wariantów.</p>`+
      `<div class="table-scroll"><table class="data-table"><thead><tr><th>Produkt</th><th>Wariant</th><th>Cena</th><th>Akcje</th></tr></thead><tbody>${variants.map(v=>`<tr><td>${escapeHTML(productName(v.product_id))}</td><td><strong>${escapeHTML(v.name)}</strong><br><small>${escapeHTML([v.color,v.size].filter(Boolean).join(' / '))}</small></td><td>${cash(v.price)}</td><td class="actions"><button data-admin-action="variant-edit" data-id="${v.id}">Edytuj</button><button data-admin-action="variant-delete" data-id="${v.id}">Usuń</button></td></tr>`).join('')}</tbody></table></div>`;
  }else if(adminTab==='orders'){
    target.innerHTML=headRow('Zamówienia')+'<p class="subtle">Po potwierdzeniu płatności przez Stripe nadaj przesyłkę ręcznie. Wprowadź numer śledzenia i wybierz status. Nie zmieniaj statusu wysyłki przed opłaceniem.</p><div id="adminOrderTable">Wczytywanie…</div>';
    sb.from('checkout_orders').select('id,email,recipient,phone,delivery_address,items,total,shipping_cost,status,payment_status,inpost_tracking,created_at').eq('payment_status','paid').order('created_at',{ascending:false}).limit(100).then(({data,error})=>{
      if(error){$('adminOrderTable').textContent=niceError(error);return}
      $('adminOrderTable').innerHTML=data.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Zamówienie</th><th>Odbiorca</th><th>Produkty</th><th>Kwota</th><th>Płatność</th><th>Adres doręczenia</th><th>Nadanie ręczne</th></tr></thead><tbody>${data.map(o=>`<tr><td><strong>${escapeHTML(o.id.slice(0,8))}</strong><br><small>${shortDate(o.created_at)}</small></td><td>${escapeHTML(o.recipient)}<br><small>${escapeHTML(o.email)}<br>${escapeHTML(o.phone)}</small></td><td><small>${(Array.isArray(o.items)?o.items:[]).map(i=>escapeHTML((i.name||'Produkt')+' / '+(i.variant||'')+' × '+Number(i.quantity||0))).join('<br>')}</small></td><td>${cash(o.total)}</td><td><span class="status ${o.payment_status==='paid'?'':'off'}">${escapeHTML(polishStatus(o.payment_status))}</span></td><td>${escapeHTML([o.delivery_address?.street,o.delivery_address?.apartment?('lok. '+o.delivery_address.apartment):'',o.delivery_address?.postal_code,o.delivery_address?.city].filter(Boolean).join(', ')||'Brak adresu')}</td><td><select data-shipping-status="${o.id}" ${o.payment_status==='paid'?'':'disabled'}>${['paid','in_production','shipped','delivered','cancelled'].map(status=>`<option value="${status}" ${selected(status,o.status)}>${polishStatus(status)}</option>`).join('')}</select><input aria-label="Numer śledzenia InPost" data-tracking="${o.id}" value="${escapeHTML(o.inpost_tracking||'')}" placeholder="Numer śledzenia" maxlength="60" ${o.payment_status==='paid'?'':'disabled'}><button type="button" class="secondary-btn" data-save-shipping="${o.id}" ${o.payment_status==='paid'?'':'disabled'}>Zapisz</button></td></tr>`).join('')}</tbody></table></div>`:'<p>Brak opłaconych zamówień.</p>';
    });
  }else if(adminTab==='customers'){
    target.innerHTML=headRow('Klienci')+'<p class="subtle">Lista profili użytkowników zarejestrowanych przez Supabase Auth.</p><div id="adminCustomerTable">Wczytywanie…</div>';
    sb.from('profiles').select('id,email,display_name,phone,created_at').order('created_at',{ascending:false}).limit(100).then(({data,error})=>{
      if(error){$('adminCustomerTable').textContent=niceError(error);return}
      $('adminCustomerTable').innerHTML=data.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Użytkownik</th><th>E-mail</th><th>Telefon</th><th>Utworzono</th></tr></thead><tbody>${data.map(p=>`<tr><td>${escapeHTML(p.display_name||'—')}</td><td>${escapeHTML(p.email)}</td><td>${escapeHTML(p.phone||'—')}</td><td>${shortDate(p.created_at)}</td></tr>`).join('')}</tbody></table></div>`:'<p>Brak zarejestrowanych klientów.</p>';
    });
  }
}
function categoryForm(id=null){
  ensureAdmin();const c=categories.find(c=>c.id===id),editing=!!c;
  // Jeden poziom podkategorii: tylko kategorie główne mogą być rodzicem.
  const parents=categories.filter(x=>!x.parent_id&&x.id!==id);
  modal(`<h2 id="modalTitle">${editing?'Edytuj':'Dodaj'} kategorię</h2><p class="modal-desc">Możesz utworzyć kategorię główną albo wybrać nadrzędną i utworzyć podkategorię.</p>
  <form id="categoryForm" class="form-grid"><div class="field span2"><label>Nazwa *</label><input name="name" required maxlength="90" value="${escapeHTML(c?.name||'')}"></div>
  <div class="field span2"><label>Kategoria nadrzędna</label><select name="parent_id">${selectOptions(parents,c?.parent_id,'Brak — kategoria główna')}</select></div>
  <div class="field span2"><label>Opis</label><textarea name="description">${escapeHTML(c?.description||'')}</textarea></div>
  <div class="field"><label>Kolejność</label><input type="number" name="position" value="${c?.position??0}" min="0" max="10000"></div>
  <div class="field"><label>Widoczność</label><select name="is_active"><option value="true" ${selected(String(c?.is_active??true),'true')}>Widoczna</option><option value="false" ${selected(String(c?.is_active??true),'false')}>Ukryta</option></select></div>
  <div class="form-buttons field span2"><button type="button" class="secondary-btn" data-modal-cancel>Anuluj</button><button type="submit" class="primary-btn">Zapisz kategorię</button></div></form>`);
  $('categoryForm').addEventListener('submit',async e=>{
    e.preventDefault();const b=e.target.querySelector('[type=submit]');setLoading(b,true);let d=Object.fromEntries(new FormData(e.target));
    let payload={name:d.name.trim(),parent_id:d.parent_id||null,description:d.description.trim(),position:Number(d.position||0),is_active:d.is_active==='true'};
    if(!editing)payload.slug=defaultSlug(payload.name);
    const query=editing?sb.from('categories').update(payload).eq('id',id):sb.from('categories').insert(payload);
    const {error}=await query;if(error)fail(error);else{closeModal();notify('Kategoria zapisana.');await loadCatalog()};setLoading(b,false);
  });
}
function productForm(id=null){
  ensureAdmin();const p=products.find(p=>p.id===id),editing=!!p;
  const opts=categories.map(c=>({id:c.id,label:(c.parent_id?categoryName(c.parent_id)+' → ':'')+c.name}));
  modal(`<h2 id="modalTitle">${editing?'Edytuj':'Dodaj'} produkt</h2><p class="modal-desc">Po dodaniu produktu powstanie domyślny wariant. Kolejne kolory i rozmiary dodasz w sekcji Warianty.</p>
  <form id="productForm" class="form-grid"><div class="field span2"><label>Nazwa produktu *</label><input name="name" required maxlength="180" value="${escapeHTML(p?.name||'')}"></div>
  <div class="field span2"><label>Kategoria / podkategoria (opcjonalnie)</label><select name="category_id">${selectOptions(opts,p?.category_id,'Bez kategorii')}</select></div>
  <div class="field span2"><label>Opis produktu</label><textarea name="description">${escapeHTML(p?.description||'')}</textarea></div>
  <div class="field"><label>Cena podstawowa (zł) *</label><input name="base_price" type="number" min="0" max="9999999" step="0.01" required value="${p?.base_price??''}"></div>
  <div class="field span2"><label>Zdjęcie produktu (JPG, PNG, WebP, AVIF, do 5 MB)</label><input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif"><span class="tiny">Wysyłane do Supabase Storage. Bez plików lokalnych na Vercel.</span></div>
  <div class="field span2"><label class="check-row"><input type="checkbox" name="is_active" ${checked(p?.is_active??true)}> Produkt widoczny w sklepie</label></div>
  <div class="form-buttons field span2"><button type="button" class="secondary-btn" data-modal-cancel>Anuluj</button><button type="submit" class="primary-btn">Zapisz produkt</button></div></form>`);
  $('productForm').addEventListener('submit',async e=>{
    e.preventDefault();const b=e.target.querySelector('[type=submit]');setLoading(b,true);const d=new FormData(e.target);
    try{
      let url=p?.image_url||null;const file=d.get('photo');if(file?.size)url=await uploadImage(file);
      const payload={name:String(d.get('name')).trim(),category_id:d.get('category_id')||null,description:String(d.get('description')||'').trim(),base_price:Number(d.get('base_price')),image_url:url||null,is_active:d.get('is_active')==='on',updated_at:new Date().toISOString()};
      if(!editing)payload.slug=defaultSlug(payload.name);
      const result=editing?await sb.from('products').update(payload).eq('id',id).select('id').single():await sb.from('products').insert(payload).select('id').single();
      if(result.error)throw result.error;
      if(!editing){
        const v={product_id:result.data.id,name:'Standard',price:payload.base_price,is_active:true};
        const res=await sb.from('product_variants').insert(v);
        if(res.error){await sb.from('products').delete().eq('id',result.data.id);throw new Error('Nie udało się utworzyć wariantu domyślnego: '+niceError(res.error))}
      } else if(Number(p.base_price)!==payload.base_price){
        // Koszyk i Stripe odczytują cenę wariantu.
        // Synchronizuj domyślny wariant Standard, pozostaw inne warianty bez zmian.
        const standard=variants.find(v=>v.product_id===id && v.name==='Standard');
        if(standard){
          const {error:variantError}=await sb.from('product_variants')
            .update({price:payload.base_price}).eq('id',standard.id);
          if(variantError)throw new Error('Cena bazowa zapisana, ale cena wariantu nie została zmieniona: '+niceError(variantError));
        }
      }
      closeModal();notify('Produkt i cena zapisane.');await loadCatalog();
    }catch(err){fail(err)}finally{setLoading(b,false)}
  });
}
async function uploadImage(file){
  if(file.size>5*1024*1024)throw new Error('Plik przekracza 5 MB.');
  if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))throw new Error('Niedozwolony typ pliku.');
  const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'})[file.type];
  const path=`${crypto.randomUUID()}.${ext}`;
  const {error}=await sb.storage.from('product-images').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
  if(error)throw error;
  const {data}=sb.storage.from('product-images').getPublicUrl(path);return data.publicUrl;
}
function variantForm(id=null,defaultProductId=''){
  ensureAdmin();const v=variants.find(v=>v.id===id),editing=!!v;
  if(!products.length){notify('Najpierw dodaj produkt.');return}
  modal(`<h2 id="modalTitle">${editing?'Edytuj':'Dodaj'} wariant / podprodukt</h2><p class="modal-desc">Np. czarny, czerwony, 50 mm, 80 mm — każdy wariant z własną ceną i zdjęciem.</p>
  <form id="variantForm" class="form-grid"><div class="field span2"><label>Produkt nadrzędny *</label><select name="product_id" required>${selectOptions(products,v?.product_id||defaultProductId,'Wybierz produkt')}</select></div>
  <div class="field span2"><label>Nazwa wariantu *</label><input name="name" required maxlength="120" value="${escapeHTML(v?.name||'')}"></div>
  <div class="field"><label>Kolor</label><input name="color" maxlength="100" value="${escapeHTML(v?.color||'')}"></div>
  <div class="field"><label>Rozmiar</label><input name="size" maxlength="100" value="${escapeHTML(v?.size||'')}"></div>
  <div class="field"><label>Cena wariantu (zł) *</label><input name="price" type="number" min="0" step="0.01" required value="${v?.price??0}"></div>
  <div class="field"><label>Widoczność</label><select name="is_active"><option value="true" ${selected(String(v?.is_active??true),'true')}>Aktywny</option><option value="false" ${selected(String(v?.is_active??true),'false')}>Ukryty</option></select></div>
  <div class="field span2"><label>Zdjęcie wariantu (opcjonalne)</label><input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/avif"></div>
  <div class="form-buttons field span2"><button type="button" class="secondary-btn" data-modal-cancel>Anuluj</button><button type="submit" class="primary-btn">Zapisz wariant</button></div></form>`);
  $('variantForm').addEventListener('submit',async e=>{
    e.preventDefault();const b=e.target.querySelector('[type=submit]');setLoading(b,true);const d=new FormData(e.target);
    try{
      let url=v?.image_url||null;if(d.get('photo')?.size)url=await uploadImage(d.get('photo'));
      const payload={product_id:d.get('product_id'),name:String(d.get('name')).trim(),color:String(d.get('color')||'').trim(),size:String(d.get('size')||'').trim(),price:Number(d.get('price')),image_url:url||null,is_active:d.get('is_active')==='true'};
      const {error}=editing?await sb.from('product_variants').update(payload).eq('id',id):await sb.from('product_variants').insert(payload);
      if(error)throw error;closeModal();notify('Wariant zapisany.');await loadCatalog();
    }catch(err){fail(err)}finally{setLoading(b,false)}
  });
}
const deletingRecords=new Set();
async function deleteRecord(table,id,label,{confirmation=true}={}){
  ensureAdmin();
  if(!id||!['categories','products','product_variants'].includes(table))throw new Error('Nieprawidłowy rekord.');
  const key=table+':'+id;
  if(deletingRecords.has(key))return;
  if(confirmation){
    const prompt=table==='categories'
      ? `Czy usunąć kategorię „${categoryName(id)}”? Produkty pozostaną w sklepie bez przypisanej kategorii, a podkategorie staną się kategoriami głównymi. Tej operacji nie można cofnąć.`
      : `Czy na pewno usunąć ${label}? Tej operacji nie można cofnąć.`;
    if(!window.confirm(prompt))return;
  }
  deletingRecords.add(key);
  try{
    const {data,error}=await sb.from(table).delete().eq('id',id).select('id');
    if(error)throw error;
    if(!data?.length)throw new Error('Nie znaleziono rekordu lub brak uprawnień do usunięcia.');
    if(table==='products'){
      cart=cart.filter(item=>item.id!==id);
      saveCart();
    }
    if(table==='categories'){
      // Filtr nie może pozostać ustawiony na usuniętą kategorię.
      categoryFilter='all';subcategoryFilter='all';
    }
    await loadCatalog();
    notify(table==='products'?'Produkt usunięty.':table==='categories'?'Kategoria usunięta. Produkty zostały zachowane.':'Wariant usunięty.');
  }catch(error){fail(error)}finally{deletingRecords.delete(key)}
}
async function adminAction(action,id){
  try{ensureAdmin();
    if(action==='category-add')categoryForm();
    if(action==='category-edit')categoryForm(id);
    if(action==='category-delete')await deleteRecord('categories',id,'kategorię');
    if(action==='product-add')productForm();
    if(action==='product-edit')productForm(id);
    if(action==='product-variants'){adminTab='variants';renderAdmin();variantForm(null,id)}
    if(action==='product-delete')await deleteRecord('products',id,'produkt i jego warianty',{confirmation:false});
    if(action==='variant-add')variantForm();
    if(action==='variant-edit')variantForm(id);
    if(action==='variant-delete')await deleteRecord('product_variants',id,'wariant');
  }catch(error){fail(error)}
}
function wire(){
  $('year').textContent=new Date().getFullYear();const p=new URLSearchParams(location.search).get('payment');if(p==='success')notify('Dziękujemy! Status płatności pojawi się w Moich zamówieniach po potwierdzeniu przez operatora.');if(p==='cancelled')notify('Płatność anulowana. Koszyk został zachowany.');$('goShop').onclick=()=>showPage('shop');$('goOrders').onclick=()=>showPage('orders');$('goAdmin').onclick=()=>showPage('admin');
  $('mobileShop').onclick=()=>showPage('shop');$('mobileOrders').onclick=()=>showPage('orders');$('mobileAdmin').onclick=()=>showPage('admin');
  $('mobileNavButton').onclick=()=>{let open=$('mobileMenu').classList.toggle('hidden');$('mobileNavButton').setAttribute('aria-expanded',String(!open))};
  $('authButton').onclick=showAccountMenu;$('cartButton').onclick=openCart;$('checkoutButton').onclick=openCheckout;
  $('categoryBar').onclick=e=>{let btn=e.target.closest('[data-cat]');if(!btn)return;categoryFilter=btn.dataset.cat;subcategoryFilter='all';renderCatalog()};
  $('subcategoryBar').onclick=e=>{let btn=e.target.closest('[data-subcat]');if(!btn)return;subcategoryFilter=btn.dataset.subcat;renderCatalog()};
  $('searchProducts').oninput=renderCatalog;$('sortProducts').onchange=renderCatalog;
  $('heroFeatured').onclick=e=>{const b=e.target.closest('[data-featured-product]');if(b)productModal(b.dataset.featuredProduct)};
  $('productGrid').onclick=e=>{let button=e.target.closest('[data-view-product]');if(button)productModal(button.dataset.viewProduct)};
  $('adminTabs').onclick=e=>{let b=e.target.closest('[data-tab]');if(b){adminTab=b.dataset.tab;renderAdmin()}};
  
  $('adminContent').onclick=async e=>{
   let b=e.target.closest('[data-save-shipping]');
   if(b){if(!isAdmin)return;const id=b.dataset.saveShipping;const status=$('adminContent').querySelector(`[data-shipping-status="${id}"]`)?.value;const tracking=$('adminContent').querySelector(`[data-tracking="${id}"]`)?.value.trim()||null;
     if(status==='shipped'&&!tracking){notify('Przed oznaczeniem jako wysłane wpisz numer śledzenia.');return}
     b.disabled=true;const {error}=await sb.from('checkout_orders').update({status,inpost_tracking:tracking}).eq('id',id).eq('payment_status','paid');b.disabled=false;
     if(error)fail(error);else{notify('Zapisano informacje o nadaniu.');renderAdmin()}return;
   }
   let action=e.target.closest('[data-admin-action]');
   if(action&&!action.disabled){
     if(action.dataset.adminAction?.endsWith('-delete')){
       action.disabled=true;
       const oldText=action.textContent;
       action.textContent='Usuwanie…';
       try{await adminAction(action.dataset.adminAction,action.dataset.id)}
       finally{if(action.isConnected){action.disabled=false;action.textContent=oldText}}
     }else await adminAction(action.dataset.adminAction,action.dataset.id);
   }
 };
  $('cartItems').onclick=e=>{let plus=e.target.closest('[data-cart-qty]'),del=e.target.closest('[data-cart-remove]');if(plus){let item=cart.find(x=>x.variantId===plus.dataset.cartQty);if(!item)return;const v=variants.find(v=>v.id===item.variantId);let next=item.qty+Number(plus.dataset.change);if(next>20){notify('Maksymalnie 20 szt. wariantu w jednym zamówieniu.');return}if(next<=0)cart=cart.filter(i=>i!==item);else item.qty=next;saveCart();renderCart()}if(del){cart=cart.filter(i=>i.variantId!==del.dataset.cartRemove);saveCart();renderCart()}};
  $('screenOverlay').onclick=closeModal;$('modalClose').onclick=closeModal;document.querySelector('.drawer .close-btn').onclick=closeModal;
  $('modalBody').onclick=e=>{if(e.target.closest('[data-modal-cancel]'))closeModal()};
  document.onkeydown=e=>{if(e.key==='Escape')closeModal()};updateCartCount();
}
async function boot(){
  wire();
  if(!configured){renderHeroProducts();renderCatalog();return}
  try{
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.58.0');
    sb=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    sb.auth.onAuthStateChange((event)=>{
      if(event==='PASSWORD_RECOVERY') setTimeout(showNewPasswordModal,0);
      setTimeout(()=>refreshAuth().catch(fail),0);
    });
    await refreshAuth();
  }catch(error){fail(error);$('productGrid').innerHTML='<div class="config-warning">Nie udało się połączyć z Supabase. Sprawdź konfigurację i dostęp do Internetu.</div>'}
}
boot();
