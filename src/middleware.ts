import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  const isForgotPasswordPage = request.nextUrl.pathname.startsWith('/forgot-password');
  const isUpdatePasswordPage = request.nextUrl.pathname.startsWith('/update-password');
  const isPublicPage = isLoginPage || isForgotPasswordPage || isUpdatePasswordPage;

  if (!user && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && (isLoginPage || isForgotPasswordPage)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon-32.png|apple-touch-icon.png|icon-192.png|icon-512.png|manifest.webmanifest|sw.js).*)'
  ]
};
