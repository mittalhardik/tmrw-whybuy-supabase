import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandProvider } from './context/BrandContext';
import Login from './pages/Login';
import ProtectedLayout from './layouts/ProtectedLayout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import BrandSelection from './pages/BrandSelection';

import Config from './pages/Config';

// Placeholders for remaining pages
const Uploads = () => <div className="p-4"><h2 className="text-2xl font-bold mb-4">Uploads</h2><p className="text-gray-600">Recent uploads history.</p></div>;

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <PrivateRoute>
          <BrandProvider>
            <BrandSelection />
          </BrandProvider>
        </PrivateRoute>
      } />
      <Route path="/:brandCode" element={
        <PrivateRoute>
          <BrandProvider>
            <ProtectedLayout />
          </BrandProvider>
        </PrivateRoute>
      }>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:productId" element={<ProductDetail />} />
        {/* Pipeline moved to Products, route removed */}
        <Route path="config" element={<Config />} />
        <Route path="uploads" element={<Uploads />} />
      </Route>
      {/* Fallback for undefined routes */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
