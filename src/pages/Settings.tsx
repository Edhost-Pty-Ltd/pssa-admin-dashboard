import { useEffect, useState } from "react";
import { Badge, PageHeader } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { AdminSettings } from "../types/admin";

export default function Settings() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.getSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = await adminApi.saveSettings(settings);
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Configuration"
        title="Association & API Settings"
        description="Configure PSASA compliance defaults and inspect the frontend/backend adapter status."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-line bg-white p-6 lg:col-span-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">Association Name</label>
            <input
              value={settings.associationName}
              onChange={(e) => setSettings({ ...settings, associationName: e.target.value })}
              className="w-full rounded-xl border border-line px-3.5 py-2 text-sm focus:border-green focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-navy">Annual Fee (ZAR)</label>
              <input
                type="number"
                value={settings.annualMembershipFeeZar}
                onChange={(e) => setSettings({ ...settings, annualMembershipFeeZar: Number(e.target.value) })}
                className="w-full rounded-xl border border-line px-3.5 py-2 text-sm focus:border-green focus:outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-navy">Verification SLA (hrs)</label>
              <input
                type="number"
                value={settings.verificationSlaHours}
                onChange={(e) => setSettings({ ...settings, verificationSlaHours: Number(e.target.value) })}
                className="w-full rounded-xl border border-line px-3.5 py-2 text-sm focus:border-green focus:outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-navy">Support Email</label>
              <input
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                className="w-full rounded-xl border border-line px-3.5 py-2 text-sm focus:border-green focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <label className="flex items-center gap-2.5 text-sm font-medium text-navy">
              <input
                type="checkbox"
                checked={settings.requireIdVerification}
                onChange={(e) => setSettings({ ...settings, requireIdVerification: e.target.checked })}
                className="h-4 w-4 accent-green"
              />
              Require SA ID / Passport verification before badge issuance
            </label>
            <label className="flex items-center gap-2.5 text-sm font-medium text-navy">
              <input
                type="checkbox"
                checked={settings.autoPublishApprovedListings}
                onChange={(e) => setSettings({ ...settings, autoPublishApprovedListings: e.target.checked })}
                className="h-4 w-4 accent-green"
              />
              Auto-publish new listings from Founding &amp; Verified members
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="rounded-lg bg-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-dark"
            >
              Save Settings
            </button>
            {saved && <span className="text-xs font-semibold text-green-dark">Settings saved (sandbox)</span>}
          </div>
        </form>

        <aside className="rounded-2xl border border-line bg-white p-6 h-fit">
          <h2 className="text-base font-bold text-navy">Backend Integration Status</h2>
          <div className="mt-3">
            <Badge tone={adminApi.isMockMode() ? "green" : "navy"}>
              {adminApi.isMockMode() ? "Mock Sandbox Active" : "Live API Connected"}
            </Badge>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            All dashboard pages read and write through <code className="rounded bg-soft px-1 py-0.5 text-navy">src/lib/adminApi.ts</code>.
            When the backend team finishes the <code className="rounded bg-soft px-1 py-0.5 text-navy">/api/admin/*</code> endpoints, set{" "}
            <code className="rounded bg-soft px-1 py-0.5 text-navy">VITE_USE_MOCK_API=false</code> to switch over cleanly.
          </p>
        </aside>
      </div>
    </div>
  );
}
