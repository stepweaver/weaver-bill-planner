import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const signInSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const isProduction = process.env.NODE_ENV === "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      authorize: async (credentials) => {
        try {
          const h = await headers();
          const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
          if (!checkRateLimit(ip)) return null;
          const { username, password } = await signInSchema.parseAsync(
            credentials
          );
          // Support AUTHORIZED_USERS (user1:pass1,user2:pass2) and legacy ADMIN_USER/ADMIN_PASSWORD
          const authorizedUsersRaw = process.env.AUTHORIZED_USERS;
          const legacyUser = process.env.ADMIN_USER ?? "admin";
          const legacyPass = process.env.ADMIN_PASSWORD ?? "changeme";
          const pairs: [string, string][] = [];
          if (authorizedUsersRaw?.trim()) {
            for (const part of authorizedUsersRaw.split(",")) {
              const [u, p] = part.trim().split(":");
              if (u && p) pairs.push([u, p]);
            }
          }
          if (pairs.length === 0) pairs.push([legacyUser, legacyPass]);
          const allowed = pairs.some(
            ([u, p]) => username === u && password === p
          );
          if (allowed) return { id: "1", name: username };
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
});
