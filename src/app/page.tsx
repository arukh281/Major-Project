import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  OWNER_SESSION_COOKIE,
  verifyOwnerSessionToken,
} from "@/lib/ownerSession";
import { HomeClient } from "./HomeClient";

export default async function Home() {
  const raw = (await cookies()).get(OWNER_SESSION_COOKIE)?.value;
  if (raw) {
    try {
      const session = await verifyOwnerSessionToken(raw);
      if (session) {
        redirect("/admin");
      }
    } catch {
      // SESSION_SECRET misconfigured — still show sign-in
    }
  }

  return (
    <Suspense fallback={null}>
      <HomeClient />
    </Suspense>
  );
}
