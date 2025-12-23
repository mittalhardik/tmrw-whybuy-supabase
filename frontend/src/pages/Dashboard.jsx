import { useState, useEffect } from 'react';
import { useBrand } from '../context/BrandContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { LayoutDashboard, Package, CheckCircle, Clock, ArrowUpRight, Activity } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const COLORS = ['#818cf8', '#34d399', '#febf2c', '#f87171'];

export default function Dashboard() {
    const { currentBrand } = useBrand();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentBrand) {
            loadStats();
        }
    }, [currentBrand]);

    const loadStats = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await import('../supabase').then(m => m.supabase.auth.getSession());
            const authToken = session?.access_token;

            const res = await fetch(`/api/dashboard/stats?brand_id=${currentBrand.id}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await res.json();
            setStats(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Prepare chart data (mock for visual demo if real history limited)
    const chartData = [
        { name: 'Mon', products: 4 },
        { name: 'Tue', products: 3 },
        { name: 'Wed', products: 7 },
        { name: 'Thu', products: 2 },
        { name: 'Fri', products: 6 },
        { name: 'Sat', products: 5 },
        { name: 'Sun', products: 8 },
    ];

    // Pie data
    const pieData = stats ? [
        { name: 'Processed', value: stats.processed_products },
        { name: 'Pending', value: stats.pending_products }
    ] : [];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Overview for {currentBrand?.name}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadStats} className="btn bg-white border hover:bg-gray-50 text-sm px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 transition-all">
                        <Activity size={16} /> Refresh
                    </button>
                    <button className="btn bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all flex items-center gap-2">
                        <ArrowUpRight size={16} /> New Upload
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Products"
                    value={loading ? <Skeleton width={60} /> : stats?.total_products}
                    icon={<Package className="text-blue-500" />}
                    trend="+12% from last week"
                />
                <StatCard
                    title="Processed"
                    value={loading ? <Skeleton width={60} /> : stats?.processed_products}
                    icon={<CheckCircle className="text-green-500" />}
                    trend="Automated"
                />
                <StatCard
                    title="Pending"
                    value={loading ? <Skeleton width={60} /> : stats?.pending_products}
                    icon={<Clock className="text-yellow-500" />}
                    trend="Needs attention"
                />
                <StatCard
                    title="Active Jobs"
                    value={loading ? <Skeleton width={60} /> : stats?.active_jobs_count}
                    icon={<Activity className="text-indigo-500" />}
                    trend={stats?.active_jobs_count > 0 ? "Running now" : "Idle"}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass rounded-2xl p-6 relative overflow-hidden">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <LayoutDashboard size={18} className="text-muted-foreground" />
                        Processing Activity
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ stroke: '#818cf8', strokeWidth: 2 }}
                                />
                                <Area type="monotone" dataKey="products" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorProd)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <h3 className="text-lg font-semibold mb-6">Status Distribution</h3>
                    <div className="h-[300px] flex items-center justify-center relative">
                        {loading ? <Skeleton circle height={200} width={200} /> : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                        {/* Center Text */}
                        {!loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-3xl font-bold text-foreground">{stats?.processed_products}</span>
                                <span className="text-xs text-muted-foreground uppercase">Done</span>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-center gap-4 mt-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="w-3 h-3 rounded-full bg-indigo-400"></div> Processed
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="w-3 h-3 rounded-full bg-emerald-400"></div> Pending
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Table */}
            <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Jobs</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-muted-foreground font-medium border-b">
                            <tr>
                                <th className="pb-3 pl-2">Job ID</th>
                                <th className="pb-3">Status</th>
                                <th className="pb-3">Progress</th>
                                <th className="pb-3 text-right pr-2">Started</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/50">
                            {loading ? (
                                [1, 2, 3].map(i => <tr key={i}><td colSpan="4" className="py-4"><Skeleton /></td></tr>)
                            ) : stats?.recent_jobs?.length === 0 ? (
                                <tr><td colSpan="4" className="py-8 text-center text-muted-foreground">No recent jobs</td></tr>
                            ) : (
                                stats?.recent_jobs?.map(job => (
                                    <tr key={job.id} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 pl-2 font-mono text-xs text-gray-500">{job.id.slice(0, 8)}...</td>
                                        <td className="py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize 
                                                ${job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                    job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                        'bg-blue-100 text-blue-800'}`}>
                                                {job.status}
                                            </span>
                                        </td>
                                        <td className="py-4 text-gray-600">
                                            {job.progress} / {job.total_products}
                                        </td>
                                        <td className="py-4 text-right pr-2 text-gray-500">
                                            {new Date(job.started_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, trend }) {
    return (
        <div className="glass p-6 rounded-2xl flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-white/50 rounded-xl shadow-sm border border-white/40">
                    {icon}
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend.includes('+') ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {trend}
                </span>
            </div>
            <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
                <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
            </div>
        </div>
    );
}
