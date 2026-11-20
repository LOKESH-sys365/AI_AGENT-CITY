import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { saveGoogleUser } from "./lib/google-users";
import { saveGoogleRefreshToken } from "./lib/google-tokens";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user, account }) {
      if (account?.provider === "google") {
        token.googleId = account.providerAccountId;
        token.sub = account.providerAccountId;

        if (!account.providerAccountId || !user.name || !user.email) {
          throw new Error("Google sign-in did not provide the required profile details.");
        }

        const image = user.image ?? "";
        token.name = user.name;
        token.email = user.email;
        token.picture = image;
        saveGoogleUser({
          googleId: account.providerAccountId,
          name: user.name,
          email: user.email,
          image,
        });
        if (typeof account.refresh_token === "string") {
          saveGoogleRefreshToken(account.providerAccountId, account.refresh_token);
        }
      } else if (!token.googleId && token.sub) {
        token.googleId = token.sub;
      }
      if (user) {
        token.sub ??= user.id;
        token.name ??= user.name;
        token.email ??= user.email;
        token.picture ??= user.image;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.name = token.name ?? "";
        session.user.email = token.email ?? "";
        session.user.image = typeof token.picture === "string" ? token.picture : "";
        const googleId = token.googleId ?? token.sub;
        if (typeof googleId === "string") session.user.googleId = googleId;
      }
      return session;
    },
  },
});
