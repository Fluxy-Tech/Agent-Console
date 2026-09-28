import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "@/layout/app-shell";
import { BusinessDetailPage } from "@/pages/business/business-detail-page";
import { BusinessListPage } from "@/pages/business/business-list-page";
import { ForgotPasswordPage } from "@/pages/auth/forgot-password-page";
import { ResetPasswordPage } from "@/pages/auth/reset-password-page";
import { SignInPage } from "@/pages/auth/signin-page";
import { SignUpPage } from "@/pages/auth/signup-page";
import { AgentDetailPage } from "@/pages/agents/agent-detail-page";
import { AgentsListPage } from "@/pages/agents/agents-list-page";
import { CampaignDetailPage } from "@/pages/campaigns/campaign-detail-page";
import { CampaignsPage } from "@/pages/campaigns/campaigns-page";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { PrivacyPolicyPage } from "@/pages/legal/privacy-policy-page";
import { ReportsPage } from "@/pages/reports/reports-page";
import { ServiceIslandDetailPage } from "@/pages/service-islands/service-island-detail-page";
import { ServiceIslandQueueDetailPage } from "@/pages/service-islands/service-island-queue-detail-page";
import { ServiceIslandsListPage } from "@/pages/service-islands/service-islands-list-page";
import { TargetDetailPage } from "@/pages/targets/target-detail-page";
import { TargetsListPage } from "@/pages/targets/targets-list-page";
import { ChannelDetailPage } from "@/pages/channels/channel-detail-page";
import { ChannelsListPage } from "@/pages/channels/channels-list-page";
import { CrmPage } from "@/pages/crm/crm-page";
import { RedirectIfBootstrapped, RequireActiveCompany, RequireAuth } from "@/routes/require-auth";
import { useBootstrapSession } from "@/hooks/use-bootstrap-session";

export function App() {
  const { ready } = useBootstrapSession();

  if (!ready) {
    return <div className="bg-dot-grid min-h-screen" />;
  }

  return (
    <>
      <Toaster richColors position="top-right" />
      <CookieConsentBanner />
      <Routes>
        <Route
          path="/signin"
          element={
            <RedirectIfBootstrapped>
              <SignInPage />
            </RedirectIfBootstrapped>
          }
        />
        <Route
          path="/signup"
          element={
            <RedirectIfBootstrapped>
              <SignUpPage />
            </RedirectIfBootstrapped>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <RedirectIfBootstrapped>
              <ForgotPasswordPage />
            </RedirectIfBootstrapped>
          }
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Sem tela de apresentação: a raiz é o login (logado → /targets via RedirectIfBootstrapped). */}
        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/business" element={<BusinessListPage />} />
          <Route path="/business/:id" element={<BusinessDetailPage />} />

          <Route element={<RequireActiveCompany />}>
            <Route element={<AppShell />}>
              <Route path="/targets" element={<TargetsListPage />} />
              <Route path="/targets/:id" element={<TargetDetailPage />} />
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
              <Route path="/crm" element={<CrmPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/agents" element={<AgentsListPage />} />
              <Route path="/agents/new" element={<AgentDetailPage />} />
              <Route path="/agents/:id" element={<AgentDetailPage />} />
              <Route path="/channels" element={<ChannelsListPage />} />
              <Route path="/channels/:id" element={<ChannelDetailPage />} />
              <Route path="/service-island" element={<ServiceIslandsListPage />} />
              <Route path="/service-island/:id" element={<ServiceIslandDetailPage />} />
              <Route path="/service-island/:islandId/queue/:queueId" element={<ServiceIslandQueueDetailPage />} />
              <Route path="/access" element={<BusinessDetailPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </>
  );
}
