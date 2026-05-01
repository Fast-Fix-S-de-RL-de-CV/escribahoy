"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

const RegisterSchema = z.object({
  name: z.string().min(2, "Tu nombre debe tener al menos 2 caracteres").trim(),
  email: z.string().email("Email inválido").trim().toLowerCase(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

const LoginSchema = z.object({
  email: z.string().email("Email inválido").trim().toLowerCase(),
  password: z.string().min(1, "Contraseña requerida"),
});

export type AuthState = { error?: string } | undefined;

export async function registerAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = RegisterSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { name, email, password } = parsed.data;
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length) {
    return { error: "Ya existe una cuenta con ese email" };
  }
  const id = nanoid();
  const passwordHash = await hashPassword(password);
  await db.insert(users).values({ id, name, email, passwordHash });
  await createSession(id);
  redirect("/onboarding");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { email, password } = parsed.data;
  const found = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!found.length) {
    return { error: "Email o contraseña incorrectos" };
  }
  const ok = await verifyPassword(password, found[0].passwordHash);
  if (!ok) {
    return { error: "Email o contraseña incorrectos" };
  }
  await createSession(found[0].id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
