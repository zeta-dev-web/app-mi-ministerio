import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PerfilClient } from "./client";

export default async function PerfilPage() {
  const { userId } = await requireUser();
  const [user, roles] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, include: { serviceRole: true } }),
    db.serviceRole.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!user) throw new Error("Usuario no encontrado");

  return (
    <PerfilClient
      initial={{
        name: user.name ?? "",
        email: user.email,
        phone: user.phone ?? "",
        congregation: user.congregation ?? "",
        baptismDate: user.baptismDate?.toISOString().slice(0, 10) ?? "",
        publisherSince: user.publisherSince?.toISOString().slice(0, 10) ?? "",
        personalGoalHours: user.personalGoalHours,
        annualGoalHours: user.annualGoalHours,
        serviceRoleId: user.serviceRoleId,
        recipientName: user.recipientName ?? "",
        recipientPhone: user.recipientPhone ?? "",
      }}
      roles={roles.map((r) => ({ id: r.id, label: r.label, monthlyQuota: r.monthlyQuota }))}
    />
  );
}
