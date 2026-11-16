import Link from "next/link";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";

export default async function ForbiddenPage() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.forbidden.title} />
      <Card>
        <p className="mb-4 text-sm">{t.forbidden.body}</p>
        <Link href="/scripts" className={buttonClass}>{t.forbidden.go}</Link>
      </Card>
    </>
  );
}
