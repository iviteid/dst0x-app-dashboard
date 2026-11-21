import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.local.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type Role = "admin" | "manager" | "mandor" | "operator" | "asisten";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  role: Role;
  permission: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  mandor: "Mandor",
  operator: "Operator",
  asisten: "Asisten",
};

export const ALL_PERMISSIONS = [
  "devices.view",
  "devices.edit",
  "devices.create",
  "devices.delete",
  "sensors.view",
  "sensors.create",
  "sensors.edit",
  "sensors.delete",
  "users.view",
  "users.edit",
  "users.create",
  "users.delete",
  "settings.view",
  "settings.edit",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  manager: [
    "devices.view", "devices.edit", "devices.create",
    "sensors.view", "sensors.create", "sensors.edit",
    "users.view",
    "settings.view", "settings.edit",
  ],
  mandor: [
    "devices.view", "devices.edit",
    "sensors.view", "sensors.edit",
    "settings.view",
  ],
  operator: [
    "devices.view",
    "sensors.view", "sensors.edit",
  ],
  asisten: [
    "devices.view",
    "sensors.view",
  ],
};

export async function signUp(email: string, password: string, fullName: string, role: Role = "asisten") {
  const { data: auth, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
  });
  if (authError) throw authError;
  if (!auth.user) throw new Error("Sign up failed");
  return auth;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error || !data) return null;
  return data as UserProfile;
}

export async function getCompanyName(companyId: string | null): Promise<string | null> {
  if (!companyId) return null;
  const { data, error } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();
  if (error || !data) return null;
  return data.name as string;
}

export async function getUserPermissions(role: Role): Promise<Permission[]> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission")
    .eq("role", role);
  if (error || !data?.length) return DEFAULT_ROLE_PERMISSIONS[role];
  return data.map((r) => r.permission as Permission);
}

export async function listUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

export async function updateUserProfile(id: string, patch: Partial<Pick<UserProfile, "full_name" | "role" | "is_active">>) {
  const { error } = await supabase
    .from("user_profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteUser(id: string) {
  const { error } = await supabase
    .from("user_profiles")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export function hasPermission(userPermissions: Permission[], required: Permission): boolean {
  return userPermissions.includes(required);
}
