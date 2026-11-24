import Stripe from 'stripe';
import {createApp} from './server/app.mjs';
import {questions} from './server/question-bank.mjs';
const stripeClient = env => new Stripe(env.STRIPE_API_KEY, {
  apiVersion:'2026-11-18.endive', httpClient:Stripe.createFetchHttpClient(),
  maxNetworkRetries:2, timeout:15000,
});
const app = createApp({questions,makeStripe:stripeClient,
  verifyEvent:(body,signature,env)=>stripeClient(env).webhooks.constructEventAsync(body,signature,env.STRIPE_WEBHOOK_SECRET,300,Stripe.createSubtleCryptoProvider()),
});
export default app;
