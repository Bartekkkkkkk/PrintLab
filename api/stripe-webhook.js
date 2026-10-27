import { settings } from './_shared.js';
export const config={api:{bodyParser:false}};
async function raw(req){const chunks=[];for await(const chunk of req)chunks.push(typeof chunk==='string'?Buffer.from(chunk):chunk);return Buffer.concat(chunks);}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).end();
 try{
  const {stripe,db}=settings();const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret)throw new Error('Brak STRIPE_WEBHOOK_SECRET');
  const event=stripe.webhooks.constructEvent(await raw(req),req.headers['stripe-signature'],secret);
  if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
   const session=event.data.object;
   if(session.payment_status==='paid'){
    const id=session.metadata?.order_id;
    const {data:order,error:e}=await db.from('checkout_orders').select('id,total,payment_status,stripe_session_id').eq('id',id).single();if(e||!order)throw new Error('Nie znaleziono zamówienia');
    if(order.stripe_session_id!==session.id)throw new Error('Nieprawidłowa sesja płatności');
    if(Math.round(Number(order.total)*100)!==session.amount_total||session.currency!=='pln')throw new Error('Kwota lub waluta niezgodna');
    const {error}=await db.from('checkout_orders').update({status:'paid',payment_status:'paid',paid_at:new Date().toISOString()}).eq('id',id).neq('payment_status','paid');if(error)throw error;
   }
  }else if(event.type==='checkout.session.expired'||event.type==='checkout.session.async_payment_failed'){
   const id=event.data.object.metadata?.order_id;
   if(id)await db.from('checkout_orders').update({status:'cancelled'}).eq('id',id).eq('payment_status','unpaid');
  }
  return res.status(200).json({received:true});
 }catch(e){console.error('stripe webhook:',e.message);return res.status(400).json({error:'Webhook processing error'});}
}
