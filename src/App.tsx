import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import InquiryPage from "./pages/InquiryPage";
import SuppliersPage from "./pages/SuppliersPage";
import PricingPage from "./pages/PricingPage";
import QuotationsPage from "./pages/QuotationsPage";
import QuoteEditorPage from "./pages/QuoteEditorPage";
import AIConfigPage from "./pages/AIConfigPage";
import InsightsPage from "./pages/InsightsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Index />} />
              <Route path="/inquiries" element={<InquiryPage />} />
              <Route path="/settings/suppliers" element={<SuppliersPage />} />
              <Route path="/settings/pricing" element={<PricingPage />} />
              <Route path="/settings/ai" element={<AIConfigPage />} />
              <Route path="/quotations" element={<QuotationsPage />} />
              <Route path="/quotations/:id" element={<QuoteEditorPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              {/* ADD ALL PROTECTED CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
