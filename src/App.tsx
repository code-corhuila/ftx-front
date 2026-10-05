import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AdminLayout, PublicLayout } from "./components/Layout";
import { RequireAdmin } from "./components/RequireAdmin";
import { config } from "./config";
import { AdminCourtFormPage } from "./pages/admin/AdminCourtFormPage";
import { AdminCourtListPage } from "./pages/admin/AdminCourtListPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { AdminReservationListPage } from "./pages/admin/AdminReservationListPage";
import { AdminSchedulePage } from "./pages/admin/AdminSchedulePage";
import { AvailabilityPage } from "./pages/booking/AvailabilityPage";
import { BookingDetailsPage } from "./pages/booking/BookingDetailsPage";
import { BookingFailedPage } from "./pages/booking/BookingFailedPage";
import { ConfirmationPage } from "./pages/booking/ConfirmationPage";
import { PaymentRedirectPage } from "./pages/booking/PaymentRedirectPage";
import { CourtDetailPage } from "./pages/CourtDetailPage";
import { CourtListPage } from "./pages/CourtListPage";
import { LandingPage } from "./pages/LandingPage";
import { MockWompiPage } from "./pages/MockWompiPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { LookupPage } from "./pages/reservations/LookupPage";
import { ReservationDetailPage } from "./pages/reservations/ReservationDetailPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

/** Rutas de ftx-docs/12-ux-ui/navigation-map.md. Todo /admin exige sesión; lo demás es público. */
export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="courts" element={<CourtListPage />} />
          <Route path="courts/:courtId" element={<CourtDetailPage />} />

          <Route path="booking">
            <Route index element={<Navigate to="availability" replace />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="details" element={<BookingDetailsPage />} />
            <Route path="payment" element={<PaymentRedirectPage />} />
            <Route path="confirmation/:code" element={<ConfirmationPage />} />
            <Route path="failed" element={<BookingFailedPage />} />
          </Route>

          <Route path="reservations">
            <Route index element={<Navigate to="lookup" replace />} />
            <Route path="lookup" element={<LookupPage />} />
            <Route path=":code" element={<ReservationDetailPage />} />
          </Route>

          <Route path="admin/login" element={<AdminLoginPage />} />
          {config.mock && <Route path="mock/wompi" element={<MockWompiPage />} />}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="courts" element={<AdminCourtListPage />} />
          <Route path="courts/:courtId/edit" element={<AdminCourtFormPage />} />
          <Route path="schedules" element={<AdminSchedulePage />} />
          <Route path="reservations" element={<AdminReservationListPage />} />
        </Route>
      </Routes>
    </>
  );
}
