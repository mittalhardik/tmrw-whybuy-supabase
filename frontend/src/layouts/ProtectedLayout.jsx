import { Outlet, NavLink, useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { LayoutDashboard, ShoppingBag, Settings, LogOut, Terminal, Upload, ChevronDown, List } from 'lucide-react';
import { Toaster } from 'sonner';

export default function ProtectedLayout() {
    const { signOut } = useAuth();
    const { brands, currentBrand } = useBrand(); // Removed setCurrentBrand as we rely on URL
    const navigate = useNavigate();
    const { brandCode } = useParams();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const handleBrandChange = (e) => {
        const selectedCode = brands.find(b => b.id === e.target.value)?.code;
        if (selectedCode) {
            // Keep current page but switch brand prefix
            // Or just go to dashboard of new brand
            navigate(`/${selectedCode}/dashboard`);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50/50 font-sans text-foreground">
            <Toaster position="top-right" richColors />
            {/* Sidebar */}
            <div className="w-64 bg-white/80 backdrop-blur-xl border-r shadow-sm flex flex-col z-20">
                <div className="p-6 border-b flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg shadow-lg"></div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Gemini</h1>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <NavItem to={`/${brandCode}/dashboard`} icon={<LayoutDashboard size={20} />} label="Dashboard" />
                    <NavItem to={`/${brandCode}/products`} icon={<ShoppingBag size={20} />} label="Products" />
                    {/* Pipeline merged into products, removed independent link */}
                    <NavItem to={`/${brandCode}/uploads`} icon={<Upload size={20} />} label="Uploads" />
                    <NavItem to={`/${brandCode}/config`} icon={<Settings size={20} />} label="Configuration" />
                </nav>

                <div className="p-4 border-t">
                    <Link to="/" className="flex items-center space-x-2 text-gray-600 hover:text-primary w-full p-2 mb-2">
                        <List size={20} />
                        <span>Switch Brand</span>
                    </Link>
                    <button onClick={handleSignOut} className="flex items-center space-x-2 text-gray-600 hover:text-red-500 w-full p-2">
                        <LogOut size={20} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white shadow-sm p-4 flex justify-between items-center z-10">
                    <div className="flex items-center space-x-4">
                        <span className="text-gray-500">Current Brand:</span>
                        <div className="relative">
                            <select
                                className="appearance-none border rounded-md py-2 pl-3 pr-8 bg-gray-50 hover:bg-white transition-colors cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                value={currentBrand?.id || ''}
                                onChange={handleBrandChange}
                            >
                                {brands.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

function NavItem({ to, icon, label }) {
    return (
        <NavLink to={to} className={({ isActive }) => `flex items-center space-x-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}>
            {icon}
            <span className="font-medium">{label}</span>
        </NavLink>
    );
}
