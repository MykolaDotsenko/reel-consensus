import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRuntimeConfig } from "./runtimeConfig";

let client: SupabaseClient | null | undefined;

export const getSupabaseClient = () => {
  if (client !== undefined) return client;

  const config = getRuntimeConfig();
  if (!config.roomsEnabled || !config.supabaseUrl || !config.supabaseAnonKey) {
    client = null;
    return client;
  }

  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return client;
};

export const ensureAnonymousIdentity = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Shared rooms are not configured.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (session?.user.id) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user?.id) throw new Error("Anonymous identity could not be created.");

  return data.user.id;
};
