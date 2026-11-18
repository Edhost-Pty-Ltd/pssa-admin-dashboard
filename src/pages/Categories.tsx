import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Badge, PageHeader } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { ServiceCategory } from "../types/admin";

interface Draft {
  id?: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  examplesText: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  examplesText: "",
  sortOrder: 9,
  isActive: true,
};

export default function Categories() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => adminApi.listCategories().then(setCategories);

  useEffect(() => {
    load();
  }, []);

  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.tagline.toLowerCase().includes(search.toLowerCase()),
  );

  const openEdit = (c: ServiceCategory) => {
    setDraft({
      id: c.id,
      name: c.name,
      slug: c.slug,
      tagline: c.tagline,
      description: c.description,
      examplesText: c.examples.join(", "),
      sortOrder: c.sortOrder,
      isActive: c.isActive,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.name.trim()) return;
    setSaving(true);
    try {
      const slug =
        draft.slug.trim() ||
        draft.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      await adminApi.saveCategory({
        id: draft.id,
        name: draft.name.trim(),
        slug,
        tagline: draft.tagline.trim(),
        description: draft.description.trim(),
        examples: draft.examplesText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        sortOrder: Number(draft.sortOrder) || 1,
        isActive: draft.isActive,
      });
      setDraft(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    await adminApi.toggleCategory(id);
    await load();
  };

  const handleDelete = async (id: string) => {
    await adminApi.deleteCategory(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Personal Shopper Workflow"
        title="Service Categories"
        description="Manage the sourcing verticals available to PSSA personal shoppers and clients. Inactive categories preserve historical bookings."
        actions={
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY_DRAFT, sortOrder: categories.length + 1 })}
            className="inline-flex items-center gap-2 rounded-lg bg-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-dark"
          >
            <Icon name="plus" size={16} />
            New Category
          </button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Icon name="search" size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter categories..."
            className="w-full rounded-xl border border-line bg-white py-2.5 pr-4 pl-10 text-sm text-navy placeholder:text-muted focus:border-green focus:outline-none"
          />
        </div>
        <p className="text-xs font-medium text-muted">
          Showing {filtered.length} of {categories.length} categories ({categories.filter((c) => c.isActive).length} active)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((c) => (
          <div
            key={c.id}
            className={`flex flex-col justify-between rounded-2xl border border-line bg-white p-5 transition ${
              !c.isActive ? "opacity-65" : ""
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-navy">{c.name}</h2>
                    <Badge tone={c.isActive ? "green" : "muted"}>{c.isActive ? "Active" : "Paused"}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-medium text-green-dark">{c.tagline}</p>
                </div>
                <span className="rounded-lg bg-soft px-2.5 py-1 text-[11px] font-bold text-muted">#{c.sortOrder}</span>
              </div>

              <p className="mt-2.5 text-sm text-muted">{c.description}</p>

              {c.examples.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.examples.map((ex) => (
                    <span
                      key={ex}
                      className="rounded-md border border-line bg-soft px-2 py-0.5 text-[11px] font-medium text-navy"
                    >
                      {ex}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
              <div className="text-xs text-muted">
                <strong className="text-navy">{c.providerCount}</strong> shoppers ·{" "}
                <strong className="text-navy">{c.listingCount}</strong> listings
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggle(c.id)}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-soft"
                >
                  {c.isActive ? "Pause" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  className="rounded-lg border border-line p-1.5 text-navy hover:bg-soft"
                  aria-label={`Edit ${c.name}`}
                >
                  <Icon name="edit" size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="rounded-lg border border-line p-1.5 text-[#b42318] hover:bg-[#fff0ef]"
                  aria-label={`Delete ${c.name}`}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Modal */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy">{draft.id ? "Edit Category" : "New Service Category"}</h3>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg p-1 text-muted hover:bg-soft">
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-navy">Category Name *</label>
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full rounded-xl border border-line px-3.5 py-2 text-sm focus:border-green focus:outline-none"
                  placeholder="e.g. Luxury & Designer Sourcing"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-navy">Tagline</label>
                <input
                  value={draft.tagline}
                  onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
                  className="w-full rounded-xl border border-line px-3.5 py-2 text-sm focus:border-green focus:outline-none"
                  placeholder="Short one-line summary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-navy">Description</label>
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="w-full rounded-xl border border-line px-3.5 py-2 text-sm focus:border-green focus:outline-none"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-navy">Examples (comma-separated)</label>
                  <input
                    value={draft.examplesText}
                    onChange={(e) => setDraft({ ...draft, examplesText: e.target.value })}
                    className="w-full rounded-xl border border-line px-3.5 py-2 text-sm focus:border-green focus:outline-none"
                    placeholder="Handbags, Watches, Pickups"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-navy">Display Order</label>
                  <input
                    type="number"
                    min={1}
                    value={draft.sortOrder}
                    onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
                    className="w-full rounded-xl border border-line px-3.5 py-2 text-sm focus:border-green focus:outline-none"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-navy">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                  className="h-4 w-4 accent-green"
                />
                Category is active and visible to shoppers
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-soft"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-green px-4 py-2 text-sm font-semibold text-white hover:bg-green-dark disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Category"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
