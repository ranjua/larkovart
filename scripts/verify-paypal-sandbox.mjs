// Verify hosted credentials without charging, creating orders, or logging secrets.
if(process.env.PAYMENT_PROVIDER==='paypal') {
 if(process.env.PAYMENT_ENVIRONMENT!=='sandbox')throw Error('PayPal live activation requires a separate verified launch.');
 const id=process.env.PAYPAL_SANDBOX_CLIENT_ID, secret=process.env.PAYPAL_SANDBOX_SECRET;
 if(!id||!secret||id==='[SENSITIVE]'||secret==='[SENSITIVE]')throw Error('PayPal sandbox credentials unavailable.');
 const r=await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
 if(!r.ok)throw Error('PayPal sandbox authentication failed (HTTP '+r.status+').');
 const token=await r.json();if(typeof token.access_token!=='string')throw Error('PayPal sandbox authentication response invalid.');
 console.log('PayPal sandbox authentication verified. No payment or order created.');
}
