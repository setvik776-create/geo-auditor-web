import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://geo-auditor-web-rust.vercel.app';

export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

  try {
    const { userId } = await req.json();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: '10 GEO Audito kreditų',
              description: 'Kreditai brand assets auditams svetainėje bei Telegram bote.',
            },
            unit_amount: 900, // $9.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${SITE_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/`,
      metadata: { userId },
    });
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

