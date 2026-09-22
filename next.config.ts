import type { NextConfig } from "next";

const SAM_BYT_IMG_SRC = "img-src 'self' data: d18-a.sdn.cz api.bezrealitky.cz t.rmcl.cz www.bazos.cz";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sam-byt",
        headers: [
          { key: "Content-Security-Policy", value: SAM_BYT_IMG_SRC },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/sam-byt/:path*",
        headers: [
          { key: "Content-Security-Policy", value: SAM_BYT_IMG_SRC },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/api/sam-byt/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
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
