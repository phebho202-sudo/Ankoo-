import { PasswordForm } from "@/components/ScriptForms";
import { Card, PageHeader } from "@/components/ui";
import type { User } from "@/lib/api";
import { getI18n } from "@/lib/i18n/server";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { t } = await getI18n();
  const me = await authedFetch<User>("/api/v1/auth/me");
  return (
    <>
      <PageHeader title={t.account.title} subtitle={me.ok ? `${me.data.display_name} · ${me.data.email}` : undefined} />
      <Card title={t.account.changePassword}>
        <PasswordForm t={t.account} />
      </Card>
    </>
  );
}
