import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as unknown as { id?: string } | undefined)?.id;
  if (!session?.user?.email || !id) redirect("/login");
  return { session, userId: id, email: session.user.email };
}
