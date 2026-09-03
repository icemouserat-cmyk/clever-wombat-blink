import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from '@/components/MainLayout';
import Index from '@/pages/Index';
import NotFound from '@/pages/NotFound';

// Lazy load pages to be implemented
import InquiryPage from '@/pages/InquiryPage';
import PricingPage from '@/pages/PricingPage';
import QuotationsPage from '@/pages/QuotationsPage';
import QuoteEditorPage from '@/pages/QuoteEditorPage';
import AIConfigPage from '@/pages/AIConfigPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Index />} />
          <Route path="inquiries" element={<InquiryPage />} />
          <Route path="quotations" element={<QuotationsPage />} />
          <Route path="quotations/:id" element={<QuoteEditorPage />} />
          <Route path="settings/pricing" element={<PricingPage />} />
          <Route path="settings/ai" element={<AIConfigPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
