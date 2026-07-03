import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
  );

  const payload = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event;
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    } else {
      event = JSON.parse(payload);
    }
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    
    if (userId) {
      // 1. Get current profile credits
      const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
      const currentCredits = profile ? profile.credits : 0;
      
      // 2. Add 10 credits
      await supabase.from('profiles').update({ credits: currentCredits + 10 }).eq('id', userId);
      
      // 3. Log transaction
      await supabase.from('transactions').insert({
        user_id: userId,
        stripe_session_id: session.id,
        amount: session.amount_total,
        credits_added: 10
      });
      
      console.log(`Successfully credited 10 tokens to user ${userId}`);
    }
  }

  return Response.json({ received: true });
}
