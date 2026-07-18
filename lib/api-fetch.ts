// Kliens oldali fetch helper: a Supabase session access tokenjét
// Authorization fejlécként csatolja az API hívásokhoz (lib/api-auth.ts párja).

import { supabase } from '@/lib/supabase';

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}
