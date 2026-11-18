import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Badge, PageHeader } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { TutorialRecord } from "../types/admin";

export default function Tutorials() {
  const [tutorials, setTutorials] = useState<TutorialRecord[]>([]);

  const load = () => adminApi.listTutorials().then(setTutorials);

  useEffect(() => {
    load();
  }, []);

  const toggle = async (id: string) => {
    await adminApi.toggleTutorial(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Enablement"
        title="Shopper Tutorials & Standards"
        description="Manage onboarding videos and compliance guides for PSSA applicants and verified shoppers."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tutorials.map((t) => (
          <div key={t.id} className="flex flex-col justify-between rounded-2xl border border-line bg-white p-5">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-soft px-2.5 py-1 text-[11px] font-semibold text-navy">{t.category}</span>
                <Badge tone={t.published ? "green" : "amber"}>{t.published ? "Published" : "Draft"}</Badge>
              </div>
              <h2 className="mt-3 text-base font-bold text-navy">{t.title}</h2>
              <p className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                <Icon name="clock" size={14} /> {t.duration} · {t.audience.replace("_", " ")}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
              <span className="text-[11px] text-muted">Updated {t.updatedAt}</span>
              <button
                type="button"
                onClick={() => toggle(t.id)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-soft"
              >
                {t.published ? "Unpublish" : "Publish"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
