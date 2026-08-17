# Sandbox webhook findings

## Stripe

Official documentation: https://docs.stripe.com/webhooks

Stripe sends events to an HTTPS webhook endpoint as JSON event objects. Signature verification must use Stripe’s `Stripe-Signature` header and the raw request body; parsing or mutating the body before verification causes verification failure. Stripe’s documentation provides the `Stripe::Webhook.construct_event(payload, sig_header, endpoint_secret)` pattern and notes that local testing can use the Stripe CLI endpoint secret. Sandbox/test keys and sandbox events are intended for integration testing.

## PayPal

Official documentation: https://developer.paypal.com/api/rest/webhooks

PayPal sends HTTPS POST callbacks for subscribed event types associated with a REST app. A listener must return a 2xx response for successful receipt; PayPal retries non-2xx delivery. Authenticity can be checked with CRC32/signature verification or by posting the message, stored webhook ID, and webhook headers to PayPal’s verify-webhook-signature endpoint. The webhook is associated with the specific sandbox/REST app, so integration tests must use the matching sandbox app credentials and webhook ID.

## Implementation implication

The plugin needs provider-specific raw-body callback handling, signature verification, event normalization, and idempotent payment/order state updates. Tests should be split into deterministic local signature/normalization tests and opt-in live sandbox tests guarded by explicit environment variables, because live sandbox credentials and public callback URLs are not present in the repository.
