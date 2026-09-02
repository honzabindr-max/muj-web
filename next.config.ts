import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // H2 Buddy DEC-002: /honzik2 root je uvolněný pro Today (BUILD-26).
      // Dosavadní pitch/landing page se přestěhovala na /honzik2/o-projektu.
      // Dočasný redirect (ne permanent), dokud Today nenahradí kořen.
      // Odstranit, až BUILD-26 přidá app/honzik2/page.tsx.
      {
        source: "/honzik2",
        destination: "/honzik2/o-projektu",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
