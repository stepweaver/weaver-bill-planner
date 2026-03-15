import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const signInSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      authorize: async (credentials) => {
        try {
          const { username, password } = await signInSchema.parseAsync(
            credentials
          );
          const adminUser = process.env.ADMIN_USER ?? "admin";
          const adminPassword = process.env.ADMIN_PASSWORD ?? "changeme";
          if (username === adminUser && password === adminPassword) {
            return { id: "1", name: adminUser };
          }
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
