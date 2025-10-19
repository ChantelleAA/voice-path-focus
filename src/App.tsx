import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { FocusOverlayProvider } from "@/contexts/FocusOverlayContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Navigation } from "@/components/Navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import Index from "./pages/Index";
import SubPage from "./pages/SubPage";
import TaskDetail from "./pages/TaskDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <FocusOverlayProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Navigation />
            <main className="container mx-auto px-4 py-8">
              <Routes>
                <Route path="/login" element={<LoginForm />} />
                <Route path="/sub" element={<SubPage />} />
                <Route path="/task/:id" element={<TaskDetail />} />
                <Route path="/signup" element={<SignupForm />} />
                <Route path="/reset-password" element={<ResetPasswordForm />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
        </TooltipProvider>
      </FocusOverlayProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
