import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  const authConfigured = Boolean(
    process.env.AUTH_SECRET &&
      process.env.AUTH_GOOGLE_ID &&
      process.env.AUTH_GOOGLE_SECRET,
  );

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Agent City</h1>
        <p>Sign in to enter your city.</p>
        {!authConfigured && (
          <p className="auth-notice">
            Set AUTH_SECRET, AUTH_GOOGLE_ID, and AUTH_GOOGLE_SECRET in .env.local
            to enable sign-in.
          </p>
        )}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button className="auth-button" type="submit" disabled={!authConfigured}>
            Sign in with Google
          </button>
        </form>
      </section>
    </main>
  );
}
