import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Guest from "@/pages/Guest";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Chapters from "@/pages/Chapters";
import ChapterDetail from "@/pages/ChapterDetail";
import Members from "@/pages/Members";
import MemberDetail from "@/pages/MemberDetail";
import Programs from "@/pages/Programs";
import ProgramDetail from "@/pages/ProgramDetail";
import CalendarPage from "@/pages/CalendarPage";
import Badges from "@/pages/Badges";
import MyProgress from "@/pages/MyProgress";
import Attendance from "@/pages/Attendance";
import Newsletters from "@/pages/Newsletters";
import Announcements from "@/pages/Announcements";
import Resources from "@/pages/Resources";
import Notifications from "@/pages/Notifications";
import Administration from "@/pages/Administration";
import Profile from "@/pages/Profile";
import Trash from "@/pages/Trash";
import CompleteSignup from "@/pages/CompleteSignup";
import Galleries from "@/pages/Galleries";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import MembershipCard from "@/pages/MembershipCard";
import VerifyMember from "@/pages/VerifyMember";
import Finance from "@/pages/Finance";
import "@/App.css";

function Router() {
  const loc = useLocation();
  if (loc.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Guest />} />
      <Route path="/login" element={<Login />} />
      <Route path="/complete-signup" element={<CompleteSignup />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/cancel" element={<PaymentCancel />} />
      <Route path="/verify/:id" element={<VerifyMember />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/newsletters" element={<Newsletters />} />
        <Route path="/chapters" element={<Chapters />} />
        <Route path="/chapters/:id" element={<ChapterDetail />} />
        <Route path="/members" element={<Members />} />
        <Route path="/members/:id" element={<MemberDetail />} />
        <Route path="/members/:id/card" element={<MembershipCard />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/programs/:id" element={<ProgramDetail />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/badges" element={<Badges />} />
        <Route path="/my-progress" element={<MyProgress />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/galleries" element={<Galleries />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/administration" element={<Administration />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/trash" element={<Trash />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Router />
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}
