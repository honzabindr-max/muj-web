declare module "next-auth" {
  interface Session {
    googleSub?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    googleSub?: string;
  }
}

export type {};
