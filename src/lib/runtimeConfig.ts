export type RuntimeConfig = {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  roomsEnabled: boolean;
};

const normalize = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const isHttpsUrl = (value: string | null) => {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export const getRuntimeConfig = (): RuntimeConfig => {
  const supabaseUrl = normalize(import.meta.env.VITE_SUPABASE_URL);
  const supabaseAnonKey = normalize(import.meta.env.VITE_SUPABASE_ANON_KEY);

  return {
    supabaseUrl,
    supabaseAnonKey,
    roomsEnabled: isHttpsUrl(supabaseUrl) && Boolean(supabaseAnonKey),
  };
};
