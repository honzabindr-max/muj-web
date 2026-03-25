import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/suggest")) {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization");

  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic") {
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(":");
      if (user === process.env.AUTH_USER && pass === process.env.AUTH_PASS) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Přístup odepřen", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Suggest Dashboard"' },
  });
}
