'use client';

import { useAuth } from '@/contexts/AuthContext';
import { BrandProvider } from '@/contexts/BrandContext';
import { useRouter } from 'next/navigation';
import ProtectedLayout from '@/components/layouts/ProtectedLayout';

export default function BrandLayout({ children }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                Loading...
            </div>
        );
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    return (
        <BrandProvider>
            <ProtectedLayout>
                {children}
            </ProtectedLayout>
        </BrandProvider>
    );
}
