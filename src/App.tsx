import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/layout/AdminLayout";
import Audit from "./pages/Audit";
import Complaints from "./pages/Complaints";
import Listings from "./pages/Listings";
import Login from "./pages/Login";
import MemberDetail from "./pages/MemberDetail";
import Notifications from "./pages/Notifications";
import Overview from "./pages/Overview";
import Renewals from "./pages/Renewals";
import Settings from "./pages/Settings";
import Tutorials from "./pages/Tutorials";
import Users from "./pages/Users";
import VerificationDetail from "./pages/VerificationDetail";
import Verifications from "./pages/Verifications";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/login" element={<Login />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Overview />} />
          <Route path="verifications" element={<Verifications />} />
          <Route path="verifications/:id" element={<VerificationDetail />} />
          <Route path="renewals" element={<Renewals />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<MemberDetail />} />
          <Route path="listings" element={<Listings />} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="tutorials" element={<Tutorials />} />
          <Route path="audit" element={<Audit />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
