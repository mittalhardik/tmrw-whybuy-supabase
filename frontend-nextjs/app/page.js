'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBrand } from '@/contexts/BrandContext';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { BrandProvider } from '@/contexts/BrandContext';

function BrandSelectionContent() {
    const { brands, loading } = useBrand();
    const { signOut } = useAuth();
    const router = useRouter();

    const handleSelectBrand = (brandCode) => {
        router.push(`/${brandCode}/products`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
                    <Skeleton height={200} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-4xl">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Select a Brand</h1>
                    <p className="text-lg text-gray-600">Choose a brand workspace to continue</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {brands.map(brand => (
                        <div
                            key={brand.id}
                            onClick={() => handleSelectBrand(brand.code)}
                            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-xl hover:scale-105 transition-all cursor-pointer border border-transparent hover:border-indigo-100 group"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg mb-4 group-hover:shadow-lg transition-all"></div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">{brand.name}</h3>
                            <p className="text-gray-500 text-sm">Workspace code: {brand.code}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-12 text-center">
                    <button
                        onClick={signOut}
                        className="text-gray-500 hover:text-red-500 flex items-center gap-2 mx-auto transition-colors"
                    >
                        <LogOut size={18} />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function BrandSelectionPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
                    <Skeleton height={200} />
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <BrandProvider>
            <BrandSelectionContent />
        </BrandProvider>
    );
}
