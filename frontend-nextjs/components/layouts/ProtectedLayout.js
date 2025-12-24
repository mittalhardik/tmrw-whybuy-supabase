'use client';

import Link from 'next/link';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { ShoppingBag, LogOut, List } from 'lucide-react';

export default function ProtectedLayout({ children }) {
    const { signOut } = useAuth();
    const { currentBrand } = useBrand();
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const brandCode = params.brandCode;

    const handleSignOut = async () => {
        await signOut();
        router.push('/login');
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100/50 font-sans text-foreground">
            {/* Sidebar */}
            <div className="w-64 bg-white/90 backdrop-blur-xl border-r border-gray-200/80 shadow-xl flex flex-col z-20">
                {/* Logo Section */}
                <div className="p-6 border-b border-gray-200/80 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">G</span>
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">Gemini</h1>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                    <NavItem href={`/${brandCode}/products`} icon={<ShoppingBag size={20} />} label="Products" pathname={pathname} />
                </nav>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-200/80 space-y-1">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center space-x-3 text-gray-600 hover:text-red-500 hover:bg-red-50 w-full p-3 rounded-lg transition-all duration-200"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white/90 backdrop-blur-xl shadow-sm border-b border-gray-200/80 p-4 flex justify-between items-center z-10">
                    <div className="flex items-center space-x-3">
                        <div className="px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
                            <span className="text-sm font-semibold text-indigo-700">{currentBrand?.name || 'Loading...'}</span>
                        </div>
                    </div>

                    <Link
                        href="/"
                        className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200 border border-transparent hover:border-indigo-100"
                    >
                        <List size={18} />
                        <span className="font-medium">Switch Brand</span>
                    </Link>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}

function NavItem({ href, icon, label, pathname }) {
    const isActive = pathname === href || pathname.startsWith(href + '/');

    return (
        <Link
            href={href}
            className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${isActive
                    ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 shadow-sm border border-indigo-100'
                    : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                }`}
        >
            {icon}
            <span className="font-semibold">{label}</span>
        </Link>
    );
}
