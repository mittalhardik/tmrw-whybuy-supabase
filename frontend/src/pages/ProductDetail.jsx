import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, RefreshCw, ShoppingBag, Download, ExternalLink, Image as ImageIcon, FileText, Sparkles, CheckCircle, AlertOctagon } from 'lucide-react';
import { toast } from 'sonner';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function ProductDetail() {
    const { productId } = useParams();
    const { currentBrand } = useBrand();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pushing, setPushing] = useState(false);
    const [activeTab, setActiveTab] = useState('metadata');

    useEffect(() => {
        if (currentBrand && productId) {
            loadProduct();
        }
    }, [currentBrand, productId]);

    const loadProduct = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await import('../supabase').then(m => m.supabase.auth.getSession());
            const authToken = session?.access_token;

            const res = await fetch(`/api/products/${productId}?brand_id=${currentBrand.id}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!res.ok) throw new Error("Product not found");

            const data = await res.json();
            setProduct(data);
        } catch (error) {
            toast.error("Error loading product");
            navigate(`/${currentBrand.code}/products`);
        } finally {
            setLoading(false);
        }
    };

    const handlePushToShopify = async () => {
        if (!confirm("Are you sure you want to push this content to Shopify?")) return;

        setPushing(true);
        const toastId = toast.loading("Pushing to Shopify...");
        try {
            const { data: { session } } = await import('../supabase').then(m => m.supabase.auth.getSession());
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
                    <button onClick={() => navigate(`/${currentBrand.code}/products`)} className="mt-1 p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-gray-500" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-foreground">{product.title}</h1>
                            {product.push_status === 'pushed' && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full border border-green-200 flex items-center gap-1">
                                    <CheckCircle size={10} /> Live on Shopify
                                </span>
                            )}
                        </div>
                        <p className="text-muted-foreground text-sm mt-1 font-mono">Product ID: {product.product_id}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {processed ? (
                        <button
                            onClick={handlePushToShopify}
                            disabled={pushing}
                            className={`btn ${product.push_status === 'pushed' ? 'bg-green-600 hover:bg-green-700' : 'bg-black hover:bg-gray-800'} text-white shadow-lg px-6 py-2 rounded-lg flex items-center gap-2 transition-all`}
                        >
                            <ShoppingBag size={18} />
                            {pushing ? 'Syncing...' : product.push_status === 'pushed' ? 'Update Shopify' : 'Push to Shopify'}
                        </button>
                    ) : (
                        <button disabled className="btn bg-gray-100 text-gray-400 border border-gray-200 px-6 py-2 rounded-lg flex items-center gap-2 cursor-not-allowed">
                            <RefreshCw size={18} className="animate-spin" /> Processing...
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Visual Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass p-4 rounded-xl">
                        <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden border">
                            {product.image_urls && product.image_urls[0] ? (
                                <img src={product.image_urls[0]} alt="Original" className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                            )}
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                            {product.image_urls?.slice(0, 3).map((url, i) => (
                                <div key={i} className="aspect-square bg-gray-50 rounded-md overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
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
                </div>

                {/* Main Tabs Area */}
                <div className="lg:col-span-3">
                    <div className="glass rounded-xl overflow-hidden min-h-[600px] flex flex-col">
                        {/* Tab Headers */}
                        <div className="flex border-b bg-gray-50/50">
                            <TabButton id="metadata" label="Metadata" icon={<FileText size={18} />} active={activeTab} set={setActiveTab} />
                            <TabButton id="ecommerce" label="E-Commerce Images" icon={<ImageIcon size={18} />} active={activeTab} set={setActiveTab} />
                            <TabButton id="lookbook" label="Lookbook" icon={<Sparkles size={18} />} active={activeTab} set={setActiveTab} />
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
                                                    {/* Assuming Step 2 attributes are simple KV pairs or list */}
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
                                    {outputs.step4_ecommerce_images?.ecommerce_images?.map((img, i) => (
                                        <ImageCard key={i} img={img} title={img.attribute} />
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
                                        <ImageCard key={i} img={img} title={img.scenario} />
                                    ))}
                                    {!outputs.step6_lookbook_images && (
                                        <div className="col-span-full py-12 text-center text-gray-400">
                                            <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
                                            No lookbook images generated yet.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Raw JSON */}
                            {activeTab === 'json' && (
                                <div className="h-full rounded-lg overflow-hidden border shadow-inner">
                                    <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, height: '100%' }}>
                                        {JSON.stringify(outputs, null, 2)}
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

function ImageCard({ img, title }) {
    if (img.status === 'failed') {
        return (
            <div className="aspect-[3/4] bg-red-50 rounded-lg border border-red-100 flex flex-col items-center justify-center text-red-400 p-4 text-center">
                <AlertOctagon size={32} className="mb-2" />
                <span className="text-sm font-medium">{title}</span>
                <span className="text-xs mt-1">Generation Failed</span>
            </div>
        );
    }
    return (
        <div className="group relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden border shadow-sm">
            <img src={img.image_path} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <div className="text-white font-medium">{title}</div>
                <a href={img.image_path} target="_blank" rel="noopener noreferrer" className="ml-auto mt-2 text-white/80 hover:text-white">
                    <Download size={20} />
                </a>
            </div>
        </div>
    );
}
