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
        <div className="flex flex-col h-screen bg-gray-50 font-sans text-foreground">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    {/* Left: Brand Logo & Nav */}
                    <div className="flex items-center gap-8">
                        {/* Brand Logo */}
                        <div className="flex items-center gap-3">
                            {currentBrand?.logo ? (
                                <img src={currentBrand.logo} alt={currentBrand.name} className="h-8 w-auto object-contain" />
                            ) : (
                                <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-lg shadow-sm flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">{currentBrand?.name?.charAt(0) || 'B'}</span>
                                </div>
                            )}
                        </div>

                        {/* Navigation */}
                        <nav className="hidden md:flex items-center gap-1">
                            <NavItem href={`/${brandCode}/products`} icon={<ShoppingBag size={18} />} label="Products" pathname={pathname} />
                        </nav>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Switch Brand"
                        >
                            <List size={20} />
                        </Link>

                        <div className="w-px h-6 bg-gray-200"></div>

                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                            <LogOut size={18} />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-6">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavItem({ href, icon, label, pathname }) {
    const isActive = pathname === href || pathname.startsWith(href + '/');

    return (
        <Link
            href={href}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}
