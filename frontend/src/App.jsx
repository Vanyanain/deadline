import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Layout from "./Layout";
import Login from "./screens/Login";
import Today from "./screens/Today";
import BrainDump from "./screens/BrainDump";
import RealityCheck from "./screens/RealityCheck";
import AtRisk from "./screens/AtRisk";
import Calendar from "./screens/Calendar";
import Habits from "./screens/Habits";
import AICoach from "./screens/AICoach";
import Profile from "./screens/Profile";

function FullScreenLoader() {
  return (
    <div className="bg-background min-h-screen flex items-center justify-center">
      <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Today />} />
            <Route path="braindump" element={<BrainDump />} />
            <Route path="reality-check" element={<RealityCheck />} />
            <Route path="at-risk" element={<AtRisk />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="habits" element={<Habits />} />
            <Route path="coach" element={<AICoach />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
