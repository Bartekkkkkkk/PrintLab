import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
export function settings(){
 const { STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_SITE_URL }=process.env;
 if(!STRIPE_SECRET_KEY||!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!PUBLIC_SITE_URL) throw new Error('Brak kluczy integracji w Vercel Environment Variables');
 const url=new URL(PUBLIC_SITE_URL); if(url.protocol!=='https:')throw new Error('PUBLIC_SITE_URL wymaga HTTPS');
 return {stripe:new Stripe(STRIPE_SECRET_KEY),db:createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}),site:url.origin};
}
export function allowOrigin(req,res,site){
 const origin=req.headers.origin; if(origin&&origin!==site){res.status(403).json({error:'Niedozwolone pochodzenie'});return false;}return true;
}
export async function authorize(db,req){
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!token)throw new Error('Zaloguj się przed zakupem.');
 const {data,error}=await db.auth.getUser(token);if(error||!data?.user)throw new Error('Sesja wygasła. Zaloguj się ponownie.');
 return data.user;
}
