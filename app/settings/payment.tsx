import { Redirect } from 'expo-router';

// This screen was a stub. Route to the fully implemented payment-methods screen.
export default function PaymentRedirect() {
  return <Redirect href='/settings/payment-methods' />;
}

