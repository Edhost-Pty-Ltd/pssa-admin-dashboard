import { useEffect, useState } from "react";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { BookingRecord, BookingStatus } from "../types/admin";

export default function Bookings() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | BookingStatus>("ALL");

  const load = () => adminApi.listBookings().then(setBookings);

  useEffect(() => {
    load();
  }, []);

  const visible = bookings.filter((b) => statusFilter === "ALL" || b.status === statusFilter);

  const updateStatus = async (id: string, status: BookingStatus) => {
    await adminApi.updateBookingStatus(id, status);
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Personal Shopper Workflow"
        title="Sourcing Bookings & Runs"
        description="Track live personal shopper errands, escrow budgets, and disputed deliveries."
      />

      <div className="flex flex-wrap gap-1.5">
        {(["ALL", "REQUESTED", "IN_PROGRESS", "DELIVERED", "COMPLETED", "DISPUTED"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              statusFilter === s ? "bg-navy text-white" : "border border-line bg-white text-muted hover:text-navy"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-soft text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Client &amp; Shopper</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Budget / Fee</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((b) => (
                <tr key={b.id} className="hover:bg-soft/50">
                  <td className="px-5 py-4">
                    <p className="font-bold text-navy">{b.reference}</p>
                    <p className="text-xs text-muted">{b.scheduledFor}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-navy">{b.clientName}</p>
                    <p className="text-xs text-muted">Shopper: {b.shopperName} ({b.city})</p>
                  </td>
                  <td className="px-5 py-4 text-xs font-medium text-navy">{b.categoryName}</td>
                  <td className="px-5 py-4 text-xs">
                    <p className="font-bold text-navy">R {b.estimatedBudgetZar.toLocaleString()}</p>
                    <p className="text-muted">Fee: R {b.serviceFeeZar.toLocaleString()}</p>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={statusTone(b.status)}>{b.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <select
                      value={b.status}
                      onChange={(e) => updateStatus(b.id, e.target.value as BookingStatus)}
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-navy focus:border-green focus:outline-none"
                    >
                      <option value="REQUESTED">REQUESTED</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="DELIVERED">DELIVERED</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="DISPUTED">DISPUTED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
