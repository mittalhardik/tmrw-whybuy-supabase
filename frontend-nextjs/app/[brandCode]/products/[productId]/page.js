'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBrand } from '@/contexts/BrandContext';
import { ArrowLeft, ShoppingBag, Download, ExternalLink, Image as ImageIcon, FileText, Sparkles, CheckCircle, AlertOctagon, RefreshCw, Play, Flag } from 'lucide-react';
import { toast } from 'sonner';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { supabase } from '@/lib/supabase';

export default function ProductDetailPage() {
    const params = useParams();
    const productId = params.productId;
    const { currentBrand } = useBrand();
    const router = useRouter();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pushing, setPushing] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPipelineConfig, setShowPipelineConfig] = useState(false);
    const [pipelineConfig, setPipelineConfig] = useState({ ecommerce: true, lookbook: true });
    const [activeTab, setActiveTab] = useState('metadata');
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    useEffect(() => {
        if (currentBrand && productId) {
            loadProduct();
            checkProcessingStatus();
        }
    }, [currentBrand, productId]);

    const checkProcessingStatus = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const authToken = session?.access_token;

            const res = await fetch(`/api/pipeline/product-status/${productId}?brand_id=${currentBrand.id}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (res.ok) {
                const data = await res.json();
                setIsProcessing(data.is_processing);
            }
        } catch (error) {
            console.error('Error checking processing status:', error);
        }
    };

    // Poll processing status every 5 seconds when processing
    useEffect(() => {
        if (!currentBrand || !productId) return;

        const interval = setInterval(() => {
            checkProcessingStatus();
        }, 5000);

        return () => clearInterval(interval);
    }, [currentBrand, productId]);


    const loadProduct = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const authToken = session?.access_token;

            const res = await fetch(`/api/products/${productId}?brand_id=${currentBrand.id}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!res.ok) throw new Error("Product not found");

            const data = await res.json();
            setProduct(data);
        } catch (error) {
            toast.error("Error loading product");
            router.push(`/${currentBrand.code}/products`);
        } finally {
            setLoading(false);
        }
    };

    const handlePushToShopify = async () => {
        if (!confirm("Are you sure you want to push this content to Shopify?")) return;

        setPushing(true);
        const toastId = toast.loading("Pushing to Shopify...");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const authToken = session?.access_token;

            const res = await fetch('/api/products/push', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    product_id: product.id,
                    brand_id: currentBrand.id
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Successfully pushed to Shopify!", { id: toastId });
                setProduct(prev => ({ ...prev, push_status: 'pushed', pushed_at: new Date().toISOString() }));
            } else {
                throw new Error(data.detail || "Push failed");
            }
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setPushing(false);
        }
    };

    const handleRunPipeline = async () => {
        if (!pipelineConfig.ecommerce && !pipelineConfig.lookbook) {
            toast.error("Please select at least one mode (Ecommerce or Lookbook)");
            return;
        }

        setProcessing(true);
        const toastId = toast.loading("Starting pipeline...");
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
                    product_ids: [product.product_id],
                    modes: Object.keys(pipelineConfig).filter(k => pipelineConfig[k])
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Pipeline started! Refresh to see results.", { id: toastId });
                setShowPipelineConfig(false);
                setIsProcessing(true);
                setTimeout(() => {
                    loadProduct();
                    checkProcessingStatus();
                }, 2000);
            } else {
                throw new Error("Failed to start pipeline");
            }
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setProcessing(false);
        }
    };

    const handleFlagImage = async (imageType, imageIndex, flagged) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const authToken = session?.access_token;

            const res = await fetch(`/api/products/${product.id}/flag-image?brand_id=${currentBrand.id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image_type: imageType,
                    image_index: imageIndex,
                    flagged: flagged
                })
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(flagged ? 'Image flagged' : 'Flag removed');
                // Update local state
                setProduct(data.product);
            } else {
                const data = await res.json();
                throw new Error(data.detail || 'Failed to flag image');
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    if (loading) return (
        <div className="p-8 space-y-8 animate-pulse">
            <div className="flex gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                <div className="space-y-2 flex-1">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                </div>
            </div>
            <div className="h-96 bg-gray-200 rounded-xl"></div>
        </div>
    );

    if (!product) return null;

    const outputs = product.generated_content?.pipeline_outputs || {};
    const processed = product.processed;

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex items-start gap-4">
                    <button onClick={() => router.push(`/${currentBrand.code}/products`)} className="mt-1 p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-gray-500" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold text-foreground">{product.title}</h1>

                            {/* Sync Status Badges */}
                            {product.shopify_id && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200 flex items-center gap-1">
                                    <CheckCircle size={10} /> Synced from Shopify
                                </span>
                            )}

                            {product.push_status === 'pushed' && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full border border-green-200 flex items-center gap-1">
                                    <CheckCircle size={10} /> Published to Shopify
                                </span>
                            )}
                        </div>
                        <p className="text-muted-foreground text-sm mt-1 font-mono">Product ID: {product.product_id}</p>
                        {product.shopify_handle && (
                            <p className="text-muted-foreground text-xs mt-0.5">Handle: {product.shopify_handle}</p>
                        )}
                    </div>
                </div>

                <div className="flex gap-2">
                    {/* Refresh from Shopify - only show if product is synced */}
                    {product.shopify_id && (
                        <button
                            onClick={async () => {
                                const toastId = toast.loading("Refreshing from Shopify...");
                                try {
                                    const { data: { session } } = await supabase.auth.getSession();
                                    const authToken = session?.access_token;

                                    const res = await fetch(`/api/sync/product/${product.id}/refresh?brand_id=${currentBrand.id}`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${authToken}` }
                                    });

                                    if (res.ok) {
                                        toast.success("Product refreshed!", { id: toastId });
                                        loadProduct();
                                    } else {
                                        const data = await res.json();
                                        throw new Error(data.detail || "Refresh failed");
                                    }
                                } catch (error) {
                                    toast.error(error.message, { id: toastId });
                                }
                            }}
                            className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                        >
                            <RefreshCw size={18} />
                            Refresh
                        </button>
                    )}

                    {/* Pipeline Controls */}
                    <div className="relative">
                        <button
                            onClick={() => setShowPipelineConfig(!showPipelineConfig)}
                            disabled={processing || isProcessing}
                            className="btn bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg px-6 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            <Play size={18} />
                            {processing || isProcessing ? 'Processing...' : processed ? 'Reprocess' : 'Process'}
                        </button>

                        {showPipelineConfig && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pipeline Options</h3>
                                <div className="space-y-2 mb-4">
                                    <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={pipelineConfig.ecommerce}
                                            onChange={(e) => setPipelineConfig({ ...pipelineConfig, ecommerce: e.target.checked })}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-medium">Ecommerce</span>
                                    </label>
                                    <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={pipelineConfig.lookbook}
                                            onChange={(e) => setPipelineConfig({ ...pipelineConfig, lookbook: e.target.checked })}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-medium">Lookbook</span>
                                    </label>
                                </div>
                                <button
                                    onClick={handleRunPipeline}
                                    disabled={!pipelineConfig.ecommerce && !pipelineConfig.lookbook}
                                    className="w-full btn bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Start Pipeline
                                </button>
                            </div>
                        )}
                    </div>

                    {processed && !isProcessing ? (
                        <button
                            onClick={handlePushToShopify}
                            disabled={pushing}
                            className={`btn ${product.push_status === 'pushed' ? 'bg-green-600 hover:bg-green-700' : 'bg-black hover:bg-gray-800'} text-white shadow-lg px-6 py-2 rounded-lg flex items-center gap-2 transition-all`}
                        >
                            <ShoppingBag size={18} />
                            {pushing ? 'Syncing...' : product.push_status === 'pushed' ? 'Update Shopify' : 'Push to Shopify'}
                        </button>
                    ) : isProcessing ? (
                        <button disabled className="btn bg-gray-100 text-gray-400 border border-gray-200 px-6 py-2 rounded-lg flex items-center gap-2 cursor-not-allowed">
                            <RefreshCw size={18} className="animate-spin" /> Processing...
                        </button>
                    ) : (
                        <button disabled className="btn bg-gray-100 text-gray-400 border border-gray-200 px-6 py-2 rounded-lg flex items-center gap-2 cursor-not-allowed">
                            <ShoppingBag size={18} /> Not Processed
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Visual Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass p-4 rounded-xl">
                        <div className="relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden border group">
                            {product.image_urls && product.image_urls.length > 0 ? (
                                <>
                                    <img
                                        src={product.image_urls[selectedImageIndex]}
                                        alt={`Product image ${selectedImageIndex + 1}`}
                                        className="w-full h-full object-cover"
                                    />

                                    {/* Image Counter */}
                                    <div className="absolute top-3 right-3 bg-black/60 text-white px-2 py-1 rounded-md text-xs font-medium backdrop-blur-sm">
                                        {selectedImageIndex + 1} / {product.image_urls.length}
                                    </div>

                                    {/* Navigation Arrows */}
                                    {product.image_urls.length > 1 && (
                                        <>
                                            <button
                                                onClick={() => setSelectedImageIndex(prev => prev > 0 ? prev - 1 : product.image_urls.length - 1)}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                                                aria-label="Previous image"
                                            >
                                                <ArrowLeft size={20} />
                                            </button>
                                            <button
                                                onClick={() => setSelectedImageIndex(prev => prev < product.image_urls.length - 1 ? prev + 1 : 0)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                                                aria-label="Next image"
                                            >
                                                <ArrowLeft size={20} className="rotate-180" />
                                            </button>
                                        </>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                            )}
                        </div>

                        {/* Scrollable Thumbnail Grid */}
                        {product.image_urls && product.image_urls.length > 0 && (
                            <div className="mt-4 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                                <div className="grid grid-cols-3 gap-2">
                                    {product.image_urls.map((url, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setSelectedImageIndex(i)}
                                            className={`aspect-square bg-gray-50 rounded-md overflow-hidden border cursor-pointer transition-all ${selectedImageIndex === i
                                                ? 'ring-2 ring-primary ring-offset-2'
                                                : 'hover:ring-2 hover:ring-gray-300'
                                                }`}
                                        >
                                            <img src={url} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="glass p-4 rounded-xl space-y-3">
                        <h3 className="font-semibold text-sm text-gray-500 uppercase">Product Info</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between py-1 border-b border-gray-100">
                                <span className="text-gray-500">Vendor</span>
                                <span className="font-medium truncate">{product.vendor}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-100">
                                <span className="text-gray-500">Type</span>
                                <span className="font-medium truncate">{product.product_type}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-100">
                                <span className="text-gray-500">Created</span>
                                <span className="font-medium truncate">{new Date(product.uploaded_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Shopify Sync Info */}
                    {product.shopify_id && (
                        <div className="glass p-4 rounded-xl space-y-3">
                            <h3 className="font-semibold text-sm text-gray-500 uppercase">Shopify Sync</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between py-1 border-b border-gray-100">
                                    <span className="text-gray-500">ID</span>
                                    <span className="font-mono text-xs">{product.shopify_id}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-gray-100">
                                    <span className="text-gray-500">Handle</span>
                                    <span className="font-mono text-xs truncate">{product.shopify_handle}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-gray-100">
                                    <span className="text-gray-500">Status</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${product.shopify_status === 'active' ? 'bg-green-100 text-green-700' :
                                        product.shopify_status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>{product.shopify_status || 'N/A'}</span>
                                </div>
                                {product.last_synced_at && (
                                    <div className="flex justify-between py-1 border-b border-gray-100">
                                        <span className="text-gray-500">Last Synced</span>
                                        <span className="text-xs">{new Date(product.last_synced_at).toLocaleString()}</span>
                                    </div>
                                )}
                                {product.metafield_synced_at && (
                                    <div className="flex justify-between py-1">
                                        <span className="text-gray-500">Metafield Synced</span>
                                        <span className="text-xs">{new Date(product.metafield_synced_at).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Tabs Area */}
                <div className="lg:col-span-3">
                    <div className="glass rounded-xl overflow-hidden min-h-[600px] flex flex-col">
                        {/* Tab Headers */}
                        <div className="flex border-b bg-gray-50/50 overflow-x-auto">
                            <TabButton id="metadata" label="Metadata" icon={<FileText size={18} />} active={activeTab} set={setActiveTab} />
                            <TabButton id="ecommerce" label="E-Commerce Images" icon={<ImageIcon size={18} />} active={activeTab} set={setActiveTab} />
                            <TabButton id="lookbook" label="Lookbook" icon={<Sparkles size={18} />} active={activeTab} set={setActiveTab} />
                            {product.shopify_id && <TabButton id="shopify" label="Shopify Data" icon={<ShoppingBag size={18} />} active={activeTab} set={setActiveTab} />}
                            <TabButton id="json" label="Raw JSON" icon={<ExternalLink size={18} />} active={activeTab} set={setActiveTab} />
                        </div>

                        {/* Tab Content */}
                        <div className="p-6 flex-1 bg-white/40">
                            {/* Metadata */}
                            {activeTab === 'metadata' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="space-y-4">
                                        <div className="p-4 bg-white rounded-lg border shadow-sm">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Optimized Title</label>
                                            <div className="text-lg font-medium text-gray-900">
                                                {outputs.step1_metadata?.optimized_title || product.title}
                                            </div>
                                        </div>

                                        <div className="p-4 bg-white rounded-lg border shadow-sm">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Optimized Description</label>
                                            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                                                {outputs.step1_metadata?.optimized_description || "No description generated yet."}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-white rounded-lg border shadow-sm">
                                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">SEO Keywords</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {outputs.step1_metadata?.seo_keywords?.map((k, i) => (
                                                        <span key={i} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium border border-indigo-100">
                                                            {k}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-white rounded-lg border shadow-sm">
                                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Extracted Attributes</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {outputs.step2_attributes ? (
                                                        Object.entries(outputs.step2_attributes).map(([k, v]) => (
                                                            typeof v === 'string' && (
                                                                <span key={k} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs border">
                                                                    <span className="font-semibold">{k}:</span> {v}
                                                                </span>
                                                            )
                                                        ))
                                                    ) : <span className="text-gray-400 text-sm">No attributes yet.</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* E-Commerce Images */}
                            {activeTab === 'ecommerce' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                    {outputs.step4_ecommerce_images?.ecommerce_images?.map((img, i) => (
                                        <div key={i} className={`bg-white rounded-lg shadow-sm overflow-hidden ${img.flagged ? 'border-2 border-orange-500' : 'border'}`}>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                                                {/* Image */}
                                                <div className="bg-gray-50 rounded-lg overflow-hidden border relative">
                                                    {img.status === 'failed' ? (
                                                        <div className="aspect-[3/4] flex flex-col items-center justify-center text-red-400 p-4 text-center">
                                                            <AlertOctagon size={32} className="mb-2" />
                                                            <span className="text-sm font-medium">Generation Failed</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <img
                                                                src={img.shopify_cdn_url || img.image_path}
                                                                alt={img.attribute}
                                                                className={`w-full h-auto object-contain ${img.flagged ? 'opacity-75' : ''}`}
                                                            />
                                                            {img.flagged && (
                                                                <div className="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shadow-lg">
                                                                    <AlertOctagon size={12} /> Flagged
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                {/* Attribute Details */}
                                                <div className="flex flex-col justify-center space-y-4">
                                                    {/* Get the corresponding attribute data from step2 */}
                                                    {(() => {
                                                        const attribute = outputs.step2_attributes?.attributes?.find(
                                                            attr => attr.name === img.attribute || attr.title === img.attribute
                                                        );
                                                        return attribute ? (
                                                            <>
                                                                <div>
                                                                    <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full uppercase tracking-wider">
                                                                        {attribute.matrix_attribute}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                                                        {attribute.title}
                                                                    </h3>
                                                                    <h4 className="text-lg font-semibold text-gray-700 mb-3">
                                                                        {attribute.name}
                                                                    </h4>
                                                                    <p className="text-gray-600 leading-relaxed">
                                                                        {attribute.copy}
                                                                    </p>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div>
                                                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                                                    {img.attribute}
                                                                </h3>
                                                                <p className="text-sm text-gray-500">No attribute details available</p>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Actions */}
                                                    <div className="pt-4 border-t space-y-2">
                                                        <button
                                                            onClick={() => handleFlagImage('ecommerce', i, !img.flagged)}
                                                            className={`w-full px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${img.flagged
                                                                ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-md'
                                                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <Flag size={16} />
                                                            {img.flagged ? 'Unflag Image' : 'Flag Image'}
                                                        </button>
                                                        <a
                                                            href={img.shopify_cdn_url || img.image_path}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium"
                                                        >
                                                            <Download size={16} />
                                                            Download
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {!outputs.step4_ecommerce_images && (
                                        <div className="col-span-full py-12 text-center text-gray-400">
                                            <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
                                            No e-commerce images generated yet.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Lookbook */}
                            {activeTab === 'lookbook' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
                                    {outputs.step6_lookbook_images?.lookbook_images?.map((img, i) => (
                                        <ImageCard
                                            key={i}
                                            img={img}
                                            title={img.scenario}
                                            onFlag={() => handleFlagImage('lookbook', i, !img.flagged)}
                                        />
                                    ))}
                                    {!outputs.step6_lookbook_images && (
                                        <div className="col-span-full py-12 text-center text-gray-400">
                                            <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
                                            No lookbook images generated yet.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Shopify Data */}
                            {activeTab === 'shopify' && product.shopify_raw_data && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-white rounded-lg border shadow-sm">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Title</label>
                                            <div className="text-sm">{product.shopify_raw_data.title}</div>
                                        </div>
                                        <div className="p-4 bg-white rounded-lg border shadow-sm">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Handle</label>
                                            <div className="text-sm font-mono">{product.shopify_raw_data.handle}</div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-white rounded-lg border shadow-sm">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Description (HTML)</label>
                                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: product.shopify_raw_data.body_html || 'No description' }} />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 bg-white rounded-lg border shadow-sm">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Status</label>
                                            <div className="text-sm capitalize">{product.shopify_raw_data.status}</div>
                                        </div>
                                        <div className="p-4 bg-white rounded-lg border shadow-sm">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Published</label>
                                            <div className="text-sm">{product.shopify_raw_data.published_at ? new Date(product.shopify_raw_data.published_at).toLocaleDateString() : 'Not published'}</div>
                                        </div>
                                        <div className="p-4 bg-white rounded-lg border shadow-sm">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Updated</label>
                                            <div className="text-sm">{new Date(product.shopify_raw_data.updated_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>

                                    {product.shopify_raw_data.custom_metafields && Object.keys(product.shopify_raw_data.custom_metafields).length > 0 && (
                                        <div className="p-4 bg-white rounded-lg border shadow-sm">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">Custom Metafields</label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {Object.entries(product.shopify_raw_data.custom_metafields).slice(0, 12).map(([key, value]) => (
                                                    <div key={key} className="p-2 bg-gray-50 rounded border border-gray-100">
                                                        <div className="text-xs text-gray-500 font-medium">{key.replace(/_/g, ' ')}</div>
                                                        <div className="text-sm mt-1 truncate">{typeof value === 'string' ? value : JSON.stringify(value)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Raw JSON */}
                            {activeTab === 'json' && (
                                <div className="h-full rounded-lg overflow-hidden border shadow-inner">
                                    <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, height: '100%' }}>
                                        {JSON.stringify(product.generated_content || outputs, null, 2)}
                                    </SyntaxHighlighter>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TabButton({ id, label, icon, active, set }) {
    const isActive = active === id;
    return (
        <button
            onClick={() => set(id)}
            className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all relative ${isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
        >
            {icon}
            {label}
            {isActive && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>}
        </button>
    );
}

function ImageCard({ img, title, onFlag }) {
    if (img.status === 'failed') {
        return (
            <div className="aspect-[3/4] bg-red-50 rounded-lg border border-red-100 flex flex-col items-center justify-center text-red-400 p-4 text-center">
                <AlertOctagon size={32} className="mb-2" />
                <span className="text-sm font-medium">{title}</span>
                <span className="text-xs mt-1">Generation Failed</span>
            </div>
        );
    }

    // Use Shopify CDN URL if available (for images pushed to Shopify), otherwise use local path
    const imageSrc = img.shopify_cdn_url || img.image_path;

    return (
        <div className={`group relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden shadow-sm ${img.flagged ? 'border-2 border-orange-500' : 'border'}`}>
            <img
                src={imageSrc}
                alt={title}
                className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${img.flagged ? 'opacity-75' : ''}`}
            />

            {img.flagged && (
                <div className="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shadow-lg z-10">
                    <AlertOctagon size={12} /> Flagged
                </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <div className="text-white font-medium mb-2 line-clamp-2">{title}</div>
                <div className="flex items-center justify-between gap-2">
                    {onFlag && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onFlag();
                            }}
                            className={`flex-1 px-3 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${img.flagged
                                ? 'bg-orange-500 text-white hover:bg-orange-600'
                                : 'bg-white/90 text-gray-900 hover:bg-white'
                                }`}
                        >
                            <Flag size={14} />
                            {img.flagged ? 'Unflag' : 'Flag'}
                        </button>
                    )}
                    <a
                        href={imageSrc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-white/20 text-white hover:bg-white/40 rounded backdrop-blur-sm transition-colors"
                        title="Download"
                    >
                        <Download size={18} />
                    </a>
                </div>
            </div>
        </div>
    );
}
