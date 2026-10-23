import { z } from "zod";
import { AuthForm } from "@/components/auth-form";

const invitedEmail = z.email().max(254);

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { email } = await searchParams;
  // Only a well-formed address prefills the field; anything else is ignored.
  return <AuthForm mode="signup" defaultEmail={invitedEmail.safeParse(email).data} />;
}
