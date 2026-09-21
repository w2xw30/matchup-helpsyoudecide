import { useStore } from "../store/useStore";
import { sb } from "./client";
import { IS_BACKEND } from "./config";
import { useBackend } from "./status";
import { bootBackend, clearLocalData } from "./sync";

/** Log in. Returns an error message, or null on success. Works in both local and online mode. */
export async function signIn(email: string, password: string): Promise<string | null> {
  if (!IS_BACKEND) {
    useStore.getState().login(email);
    return null;
  }
  const { error } = await sb().auth.signInWithPassword({ email, password });
  if (error) return /invalid login/i.test(error.message) ? "Email or password is incorrect." : error.message;
  return null;
}

/** Create an account. A guest keeps their lobbies: the anonymous account is upgraded in place. */
export async function signUp(email: string, password: string, name: string): Promise<{ error?: string; notice?: string }> {
  if (!IS_BACKEND) {
    useStore.getState().login(email, name);
    return {};
  }
  const { data: current } = await sb().auth.getUser();
  if (current.user?.is_anonymous) {
    const { error } = await sb().auth.updateUser({ email, password, data: { name } });
    if (error) return { error: /already/i.test(error.message) ? "An account with this email already exists — log in instead." : error.message };
    await sb().from("profiles").update({ name }).eq("id", current.user.id);
    const { data: after } = await sb().auth.getUser();
    if (after.user?.is_anonymous) return { notice: "Check your inbox to confirm your email address, then log in." };
    return {};
  }
  const { error } = await sb().auth.signUp({ email, password, options: { data: { name } } });
  return error ? { error: error.message } : {};
}

/** Log out, then start a fresh anonymous session so the app stays usable. */
export async function signOutUser() {
  if (!IS_BACKEND) {
    useStore.getState().logout();
    return;
  }
  await sb().auth.signOut();
  clearLocalData();
  await bootBackend(true);
}

/** Delete the account (and everything it owns) — or, for guests / local mode, just reset. */
export async function deleteAccountEverywhere() {
  if (!IS_BACKEND) {
    useStore.getState().deleteAccount();
    return;
  }
  await sb().rpc("delete_my_account");
  await sb().auth.signOut();
  clearLocalData();
  useStore.getState().deleteAccount();
  await bootBackend(true);
}

/** "Forgot password?" — sends a reset link (online mode). Returns an error message or null. */
export async function resetPassword(email: string): Promise<string | null> {
  if (!IS_BACKEND) return null;
  const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  return error ? error.message : null;
}

/** Change the password. `current` is not needed after a reset-link login. Returns an error message or null. */
export async function changePassword(current: string | null, next: string): Promise<string | null> {
  if (!IS_BACKEND) return null;
  if (current !== null) {
    const { data } = await sb().auth.getUser();
    const email = data.user?.email;
    if (!email) return "Log in to change your password.";
    const check = await sb().auth.signInWithPassword({ email, password: current });
    if (check.error) return "Your current password is incorrect.";
  }
  const { error } = await sb().auth.updateUser({ password: next });
  if (!error) useBackend.setState({ recovery: false });
  return error ? error.message : null;
}
