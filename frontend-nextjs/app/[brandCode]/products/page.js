'use client';

import { supabase } from '@/lib/supabase';


import { useState, useEffect, useCallback } from 'react';
import { useBrand } from '@/contexts/BrandContext';
import { useAuth } from '@/contexts/AuthContext';
import { Filter, Search, MoreHorizontal, Check, AlertCircle, ShoppingBag, ArrowUpRight, Play, RotateCw, History, X } from 'lucide-react';
import { toast } from 'sonner';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import Link from 'next/link';
import AddProductModal from '@/components/AddProductModal';

export default function Products() {
    const { currentBrand } = useBrand();
    const { user } = useAuth();

    // Data
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);


    // Filters & Pagination
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState({ processed: null, push_status: null });
    const [showFilters, setShowFilters] = useState(false);

    // Selection & Pipeline
    const [processing, setProcessing] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [jobs, setJobs] = useState([]);

    // Pipeline Config
    const [pipelineConfig, setPipelineConfig] = useState({ ecommerce: true, lookbook: true });
    const [showPipelineConfig, setShowPipelineConfig] = useState(false);

    // Debounce Search
    useEffect(() => {
        const handler = setTimeout(() => {
            if (currentBrand) loadProducts(1); // Reset to page 1 on search
        }, 500);
        return () => clearTimeout(handler);
    }, [search, currentBrand, filters]);

    // Pagination Click
    useEffect(() => {
        if (currentBrand) loadProducts(page);
    }, [page]);

    // Poll jobs if history is open
    useEffect(() => {
        let interval;
        if (showHistory && currentBrand) {
            loadJobs();
            interval = setInterval(loadJobs, 5000);
        }
        return () => clearInterval(interval);
    }, [showHistory, currentBrand]);

    const loadProducts = async (p = page) => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const authToken = session?.access_token;

            let query = `?brand_id=${currentBrand.id}&page=${p}&limit=20`;
            if (search) query += `&search=${encodeURIComponent(search)}`;
            if (filters.processed !== null) query += `&processed=${filters.processed}`;
            if (filters.push_status) query += `&push_status=${filters.push_status}`;

            const res = await fetch(`/api/products${query}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await res.json();
            setProducts(data.products || []);
            setTotal(data.total || 0);
            if (p !== page) setPage(p);
        } catch (error) {
            toast.error("Failed to load products");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };



    const loadJobs = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const authToken = session?.access_token;
            const res = await fetch(`/api/pipeline/jobs?brand_id=${currentBrand.id}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await res.json();
            setJobs(data.jobs || []);
        } catch (e) {
            console.error(e);
        }
    };

    const handleRunPipeline = async (productIds = selectedProducts) => {
        if (productIds.length === 0) {
            toast.error("Select products to process");
            return;
        }

        setProcessing(true);
        const toastId = toast.loading("Starting pipeline job...");

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const authToken = session?.access_token;

            const res = await fetch(`/api/pipeline/run`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    brand_id: currentBrand.id,
                    product_ids: productIds,
                    modes: Object.keys(pipelineConfig).filter(k => pipelineConfig[k])
                })
            });
            const data = await res.json();

            if (data.success) {
                toast.success("Pipeline job started!", { id: toastId });
                setSelectedProducts([]);
                setShowHistory(true);
            } else {
                throw new Error("Failed to start job");
            }
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setProcessing(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedProducts.length === products.length) {
            setSelectedProducts([]);
        } else {
            setSelectedProducts(products.map(p => p.product_id));
        }
    };

    const toggleProduct = (id) => {
        if (selectedProducts.includes(id)) {
            setSelectedProducts(selectedProducts.filter(p => p !== id));
        } else {
            setSelectedProducts([...selectedProducts, id]);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Products</h1>
                    <p className="text-muted-foreground mt-1">Manage your catalogue and pipeline status</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowHistory(true)}
                        className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 transition-all"
                    >
                        <History size={18} />
                        Jobs
                    </button>


                    <div className="relative">
                        <button
                            onClick={() => setShowPipelineConfig(!showPipelineConfig)}
                            className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-lg shadow-sm transition-all"
                            title="Pipeline Settings"
                        >
                            <MoreHorizontal size={18} />
                        </button>

                        {showPipelineConfig && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-50 animate-in fade-in slide-in-from-top-2">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Run Options</h3>
                                <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={pipelineConfig.ecommerce}
                                        onChange={(e) => setPipelineConfig({ ...pipelineConfig, ecommerce: e.target.checked })}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm">Ecommerce</span>
                                </label>
                                <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={pipelineConfig.lookbook}
                                        onChange={(e) => setPipelineConfig({ ...pipelineConfig, lookbook: e.target.checked })}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm">Lookbook</span>
                                </label>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => handleRunPipeline()}
                        disabled={selectedProducts.length === 0 || processing || (!pipelineConfig.ecommerce && !pipelineConfig.lookbook)}
                        className="btn bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                    >
                        <Play size={18} />
                        Run Pipeline ({selectedProducts.length})
                    </button>
                    <AddProductModal currentBrand={currentBrand} onSuccess={() => loadProducts(1)} />
                </div>
            </div>

            {/* Controls */}
            <div className="glass p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by title..."
                        className="w-full pl-10 pr-4 py-2 bg-white/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-white/50'}`}
                    >
                        <Filter size={18} />
                        Filters
                    </button>
                </div>
            </div>

            {/* Active Filters Panel */}
            {
                showFilters && (
                    <div className="bg-white/50 border border-border p-4 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                        <select
                            className="p-2 rounded-lg border bg-white text-sm"
                            value={filters.processed === null ? 'all' : filters.processed}
                            onChange={(e) => setFilters({ ...filters, processed: e.target.value === 'all' ? null : e.target.value === 'true' })}
                        >
                            <option value="all">Processing Status: All</option>
                            <option value="true">Processed</option>
                            <option value="false">Pending</option>
                        </select>

                        <select
                            className="p-2 rounded-lg border bg-white text-sm"
                            value={filters.push_status || 'all'}
                            onChange={(e) => setFilters({ ...filters, push_status: e.target.value === 'all' ? null : e.target.value })}
                        >
                            <option value="all">Shopify Status: All</option>
                            <option value="pushed">Pushed</option>
                            <option value="pending">Not Pushed</option>
                        </select>
                    </div>
                )
            }

            {/* Products Grid/Table */}
            <div className="glass rounded-xl overflow-hidden min-h-[400px]">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/50 text-muted-foreground text-xs uppercase tracking-wider border-b">
                        <tr>
                            <th className="p-4 w-10">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={products.length > 0 && selectedProducts.length === products.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="p-4 w-16">Image</th>
                            <th className="p-4">Product Details</th>
                            <th className="p-4 hidden md:table-cell">Vendor & Type</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 hidden md:table-cell">Shopify</th>
                            <th className="p-4 w-20">Actions</th>
                            <th className="p-4 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <tr key={i}>
                                    <td className="p-4"><Skeleton height={48} width={48} borderRadius={8} /></td>
                                    <td className="p-4"><Skeleton count={2} /></td>
                                    <td className="p-4 hidden md:table-cell"><Skeleton /></td>
                                    <td className="p-4"><Skeleton width={80} /></td>
                                    <td className="p-4 hidden md:table-cell"><Skeleton width={80} /></td>
                                    <td className="p-4"><Skeleton circle width={24} height={24} /></td>
                                </tr>
                            ))
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="p-12 text-center text-muted-foreground">
                                    No products found matching your criteria.
                                </td>
                            </tr>
                        ) : (
                            products.map(product => (
                                <tr
                                    key={product.id}
                                    className={`group hover:bg-indigo-50/30 transition-colors cursor-pointer ${selectedProducts.includes(product.product_id) ? 'bg-indigo-50/50' : ''}`}
                                    onClick={() => toggleProduct(product.product_id)}
                                >
                                    <td className="p-4 align-top" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-primary focus:ring-primary"
                                            checked={selectedProducts.includes(product.product_id)}
                                            onChange={() => toggleProduct(product.product_id)}
                                        />
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="w-12 h-16 bg-gray-100 rounded-lg overflow-hidden border">
                                            {product.image_urls && product.image_urls[0] ? (
                                                <img src={product.image_urls[0]} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-xs text-gray-300">No img</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                            {product.title}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1 font-mono">
                                            ID: {product.product_id}
                                        </div>
                                    </td>
                                    <td className="p-4 align-top hidden md:table-cell">
                                        <div className="text-sm text-gray-700">{product.vendor || 'Unknown Vendor'}</div>
                                        <div className="text-xs text-gray-400">{product.product_type}</div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <StatusBadge processed={product.processed} />
                                    </td>
                                    <td className="p-4 align-top hidden md:table-cell">
                                        {product.push_status === 'pushed' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                                <Check size={10} /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                                                Sync needed
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 align-top" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleRunPipeline([product.product_id])}
                                            disabled={processing}
                                            className="text-xs bg-white border border-gray-200 hover:border-primary hover:text-primary px-2 py-1 rounded transition-colors"
                                        >
                                            {product.processed ? 'Reprocess' : 'Process'}
                                        </button>
                                    </td>
                                    <td className="p-4 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                                        <Link href={`/${currentBrand.code}/products/${product.product_id}`} target="_blank">
                                            <ArrowUpRight size={16} className="text-gray-300 group-hover:text-primary transition-colors" />
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center text-sm text-muted-foreground pt-4">
                <span>Showing {products.length} of {total} products</span>
                <div className="flex gap-2">
                    <button
                        disabled={page === 1 || loading}
                        onClick={(e) => { e.stopPropagation(); setPage(page - 1); }}
                        className="px-4 py-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                    >
                        Previous
                    </button>
                    <button
                        disabled={products.length < 20 || loading}
                        onClick={(e) => { e.stopPropagation(); setPage(page + 1); }}
                        className="px-4 py-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>
            {/* Job History Side Panel */}
            {
                showHistory && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
                        <div className="relative w-full max-w-md bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
                            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                                <h2 className="font-semibold text-lg flex items-center gap-2">
                                    <History size={20} className="text-primary" />
                                    Pipeline History
                                </h2>
                                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {jobs.map(job => (
                                    <div key={job.id} className="bg-white border p-4 rounded-xl shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide
                                                ${job.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                        job.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                            'bg-blue-100 text-blue-700 animate-pulse'}`}>
                                                    {job.status}
                                                </span>
                                                <div className="text-xs text-gray-400 mt-1">{new Date(job.started_at).toLocaleString()}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold">{job.progress} <span className="text-sm text-gray-400 font-normal">/ {job.total_products}</span></div>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${job.status === 'failed' ? 'bg-red-400' : 'bg-primary'}`}
                                                style={{ width: `${(job.progress / job.total_products) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                                {jobs.length === 0 && (
                                    <div className="text-center text-gray-500 py-10">No recent jobs found</div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

function StatusBadge({ processed }) {
    if (processed) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Check size={12} /> Processed
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle size={12} /> Pending
        </span>
    );
}
