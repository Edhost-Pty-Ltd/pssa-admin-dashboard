import { useEffect, useState } from "react";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { ListingRecord, ListingStatus } from "../types/admin";

export default function Listings() {
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const load = () => adminApi.listListings().then(setListings);

  useEffect(() => {
    load();
  }, []);

  const categories = Array.from(new Set(listings.map((l) => l.categoryName)));
  const visible = listings.filter((l) => categoryFilter === "ALL" || l.categoryName === categoryFilter);

  const setStatus = async (id: string, status: ListingStatus) => {
    await adminApi.updateListingStatus(id, status);
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Trust & Profiles"
        title="Verified Shopper Profiles"
        description="Verify that personal shopper specialty profiles and declared sourcing channels comply with PSSA safety policies."
      />

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategoryFilter("ALL")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            categoryFilter === "ALL" ? "bg-navy text-white" : "border border-line bg-white text-muted hover:text-navy"
          }`}
        >
          All Categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              categoryFilter === cat ? "bg-navy text-white" : "border border-line bg-white text-muted hover:text-navy"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((item) => (
          <div key={item.id} className="flex flex-col justify-between rounded-2xl border border-line bg-white p-5">
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-md bg-soft px-2.5 py-1 text-[11px] font-semibold text-navy">
                  {item.categoryName}
                </span>
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              </div>
              <h2 className="mt-3 text-base font-bold text-navy">{item.title}</h2>
              <p className="mt-1 text-xs text-muted">
                Shopper: <strong className="text-navy">{item.shopperName}</strong> · {item.city}
              </p>
              <p className="mt-2.5 text-xs leading-relaxed text-ink">{item.specialtySummary}</p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
              <p className="text-[11px] font-medium text-muted">Added {item.createdAt}</p>
              <div className="flex gap-2">
                {item.status !== "ACTIVE" && (
                  <button
                    type="button"
                    onClick={() => setStatus(item.id, "ACTIVE")}
                    className="rounded-lg bg-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-dark"
                  >
                    Verify Profile
                  </button>
                )}
                {item.status !== "PAUSED" && (
                  <button
                    type="button"
                    onClick={() => setStatus(item.id, "PAUSED")}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-soft"
                  >
                    Pause
                  </button>
                )}
                {item.status !== "FLAGGED" && (
                  <button
                    type="button"
                    onClick={() => setStatus(item.id, "FLAGGED")}
                    className="rounded-lg border border-[#f9c8c4] px-3 py-1.5 text-xs font-semibold text-[#b42318] hover:bg-[#fff0ef]"
                  >
                    Flag
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
