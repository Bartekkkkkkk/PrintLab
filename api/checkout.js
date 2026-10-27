import { settings, allowOrigin, authorize } from './_shared.js';
const LIMIT_ITEMS=20;
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Metoda niedozwolona'});
 try{
  const {stripe,db,site}=settings();if(!allowOrigin(req,res,site))return;
  const user=await authorize(db,req);
  const {items,address,recipient,phone,recipientEmail}=req.body||{};
  if(!Array.isArray(items)||items.length<1||items.length>LIMIT_ITEMS)throw new Error('Nieprawidłowy koszyk.');
  if(!address||typeof address!=='object'||Array.isArray(address))throw new Error('Podaj adres dostawy.');
  const validText=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max;
  if(!validText(address.street,3,160))throw new Error('Podaj ulicę i numer domu.');
  if(!validText(address.city,2,90))throw new Error('Podaj miejscowość.');
  if(typeof address.postal_code!=='string'||!/^[0-9]{2}-[0-9]{3}$/.test(address.postal_code))throw new Error('Podaj kod pocztowy w formacie 00-000.');
  if(address.apartment!=null&&typeof address.apartment!=='string')throw new Error('Nieprawidłowy numer lokalu.');
  if((address.apartment||'').trim().length>32)throw new Error('Numer lokalu jest za długi.');
  const deliveryAddress={street:address.street.trim(),apartment:(address.apartment||'').trim(),postal_code:address.postal_code,city:address.city.trim(),country:'PL'};
  if(typeof recipient!=='string'||recipient.trim().length<3||recipient.length>120)throw new Error('Wpisz imię i nazwisko odbiorcy.');
  if(typeof phone!=='string'||!/^\+?[0-9 ]{9,16}$/.test(phone))throw new Error('Podaj poprawny numer telefonu.');
  const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if(typeof recipientEmail!=='string'||recipientEmail.length>254||!emailPattern.test(recipientEmail.trim()))throw new Error('Podaj poprawny e-mail odbiorcy.');
  const contactEmail=recipientEmail.trim().toLowerCase();

  const ids=[];const quantities=new Map();
  for(const item of items){if(typeof item.variantId!=='string'||!(/^[0-9a-f-]{36}$/i).test(item.variantId)||!Number.isSafeInteger(item.qty)||item.qty<1||item.qty>20)throw new Error('Nieprawidłowy produkt lub ilość.');
    if(!quantities.has(item.variantId))ids.push(item.variantId);
    quantities.set(item.variantId,(quantities.get(item.variantId)||0)+item.qty);
  }
  if([...quantities.values()].some(q=>q>20))throw new Error('Przekroczona ilość wariantu.');
  const {data:rows,error}=await db.from('product_variants').select('id,name,price,is_active,product_id,products!inner(name,is_active)').in('id',ids);
  if(error)throw error;
  const lineItems=[];const snapshot=[];
  for(const id of ids){const v=rows?.find(v=>v.id===id);const qty=quantities.get(id);
    if(!v||!v.is_active||!v.products?.is_active)throw new Error('Produkt jest niedostępny.');
    const cents=Math.round(Number(v.price)*100);if(!Number.isSafeInteger(cents)||cents<100||cents>100000000)throw new Error('Nieprawidłowa cena.');
    lineItems.push({price_data:{currency:'pln',unit_amount:cents,product_data:{name:`${v.products.name} — ${v.name}`.slice(0,200)}},quantity:qty});
    snapshot.push({variant_id:id,product_id:v.product_id,name:v.products.name,variant:v.name,quantity:qty,unit_price:cents/100});
  }
  // Ustaw koszt zgodnie z umową z InPost; tę kwotę klient widzi przed zapłatą.
  const shippingCents=Number(process.env.INPOST_SHIPPING_GROSZE||'1499');
  if(!Number.isSafeInteger(shippingCents)||shippingCents<0||shippingCents>100000)throw new Error('Błędny koszt dostawy.');
  const total=(lineItems.reduce((sum,l)=>sum+l.price_data.unit_amount*l.quantity,0)+shippingCents)/100;
  const {data:order,error:insertError}=await db.from('checkout_orders').insert({user_id:user.id,email:contactEmail,recipient:recipient.trim(),phone:phone.replaceAll(' ',''),delivery_address:deliveryAddress,items:snapshot,total,shipping_cost:shippingCents/100,status:'pending_payment',payment_status:'unpaid'}).select('id').single();
  if(insertError)throw insertError;
  try{
   const session=await stripe.checkout.sessions.create({mode:'payment',customer_email:contactEmail,line_items:[...lineItems,{price_data:{currency:'pln',unit_amount:shippingCents,product_data:{name:'InPost Kurier — dostawa pod adres'}},quantity:1}],client_reference_id:order.id,metadata:{order_id:order.id},success_url:`${site}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${site}/?payment=cancelled`,expires_at:Math.floor(Date.now()/1000)+1800});
   await db.from('checkout_orders').update({stripe_session_id:session.id}).eq('id',order.id);
   return res.status(200).json({url:session.url});
  }catch(e){await db.from('checkout_orders').update({status:'cancelled'}).eq('id',order.id);throw e;}
 }catch(e){console.error('checkout:',e?.message);return res.status(400).json({error:e?.message||'Nie udało się rozpocząć płatności.'});}
}
