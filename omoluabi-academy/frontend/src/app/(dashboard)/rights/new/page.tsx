import Link from "next/link";
import { LicenceForm } from "@/components/RightsForms";
import { Alert, Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";

export default async function NewLicencePage() {
  const { t } = await getI18n();
  return (
    <>
      <Link href="/rights" className="mb-3 inline-block text-sm text-navy underline decoration-gold underline-offset-4">
        ← {t.rights.back}
      </Link>
      <PageHeader title={t.rights.newLicence} />
      <div className="mb-5">
        <Alert tone="warn">{t.rights.disclaimer}</Alert>
      </div>
      <Card title={t.rights.form.details}>
        <LicenceForm t={t.rights} />
      </Card>
    </>
  );
}
