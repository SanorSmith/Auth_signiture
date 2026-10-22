import { forgotPassword } from "@/lib/account-actions";
import { fromState, readBody, toForm } from "@/lib/mobile";

// "Forgot password" from the sign-in screen: notifies the people who reset passwords. The answer is
// the same whether or not the email exists.
export async function POST(req: Request) {
  const { email } = await readBody<{ email?: string }>(req);
  return fromState(await forgotPassword(null, toForm({ email })));
}
