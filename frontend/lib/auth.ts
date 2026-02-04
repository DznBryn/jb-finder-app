import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import PostgresAdapter from "@auth/pg-adapter";

import { authPool } from "./db";

export const authOptions = {
  adapter: PostgresAdapter(authPool),
  secret: process.env.AUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile",
        },
      },
    }),
    LinkedIn({
      clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
      // Required so NextAuth/openid-client accepts LinkedIn's ID token iss claim.
      issuer: "https://www.linkedin.com/oauth",
      jwks_endpoint: "https://www.linkedin.com/oauth/openid/jwks",
      // LinkedIn OIDC userinfo returns `sub`; NextAuth expects `id`. Map sub -> id.
      profile(profile: Record<string, unknown>) {
        return {
          id: (profile.sub ?? profile.id ?? "") as string,
          name: (profile.name ?? null) as string | null,
          first_name: (profile.given_name ?? null) as string | null,
          last_name: (profile.family_name ?? null) as string | null,
          email: (profile.email ?? null) as string | null,
          image: (profile.picture ?? profile.image ?? null) as string | null,
          email_verified: (profile.email_verified ?? false) as boolean,
        };
      },
    }),
  ],
  session: {
    strategy: "database" as const,
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async signIn({
      user,
      account,
      profile,
    }: {
      user: { id?: string; email?: string | null; name?: string | null, first_name?: string | null, last_name?: string | null, email_verified?: boolean };
      account: { provider?: string } | null;
      profile?: { email?: string; name?: string; picture?: string; image?: string, first_name?: string; last_name?: string; email_verified?: boolean } | undefined;
    }) {
      const provider = account?.provider ?? "unknown";

      if (provider === "google") {
        console.log(`[Auth] Google sign-in: ${user.email}`);
        // Google-specific handling
        // profile contains: email, name, picture, email_verified, sub
        if (!profile?.email) {
          console.error("[Auth] Google sign-in failed: no email provided");
          return false;
        }
        return true;
      }

      if (provider === "linkedin") {
        console.log(`[Auth] LinkedIn sign-in: ${user.email}`);
        // LinkedIn-specific handling
        // profile contains: sub, name, email, picture
        if (!profile?.email) {
          console.error("[Auth] LinkedIn sign-in failed: no email provided");
          return false;
        }
        return true;
      }

      // Allow other providers by default
      console.log(`[Auth] Sign-in via ${provider}: ${user.email}`);
      return true;
    },
    async session({
      session,
      user,
    }: {
      session: { user?: { id?: string, first_name?: string, last_name?: string, email_verified?: boolean, email?: string, name?: string, image?: string } & Record<string, unknown> };
      user?: { id?: string };
    }) {
      if (session.user && user?.id) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};
