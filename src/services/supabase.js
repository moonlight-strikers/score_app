import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://bqpweerdxqecrxtbmhfr.supabase.co';
const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcHdlZXJkeHFlY3J4dGJtaGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NzA3MjIsImV4cCI6MjEwODI0NjcyMn0.Z2c4mPY4tjO9PUZu_Eum1-nWZWzy9MuU06F4s1ETQ6s';

const rawUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  defaultUrl;

const rawKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  defaultKey;

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  typeof rawUrl === 'string' &&
  rawUrl.startsWith('http') &&
  !rawUrl.includes('your-project') &&
  rawKey &&
  !rawKey.includes('your-anon-key')
);

const supabaseUrl = isSupabaseConfigured ? rawUrl : defaultUrl;
const supabaseAnonKey = isSupabaseConfigured ? rawKey : defaultKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

