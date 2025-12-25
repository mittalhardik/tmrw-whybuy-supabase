'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AddProductModal({ currentBrand, onSuccess }) {
    const [showModal, setShowModal] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [byHandle, setByHandle] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [batchResults, setBatchResults] = useState(null);

    const handleAddProduct = async (e) => {
        e.preventDefault();

        if (!identifier.trim()) {
            toast.error('Please enter a Product ID or Handle');
            return;
        }

        setLoading(true);

        // Parse identifiers (comma-separated)
        const identifiers = identifier
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);

        const isBatch = identifiers.length > 1;
        const toastId = toast.loading(
            isBatch
                ? `Adding ${identifiers.length} products from Shopify...`
                : 'Adding product from Shopify...'
        );

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const authToken = session?.access_token;

            if (isBatch) {
                // Use batch endpoint
                const res = await fetch(`/api/sync/products/batch`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        identifiers: identifiers,
                        by_handle: byHandle,
                        brand_id: currentBrand.id
                    })
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    setBatchResults(data);
                    setShowResults(true);

                    const { successful, failed } = data.summary;
                    if (failed === 0) {
                        toast.success(`All ${successful} products added successfully!`, { id: toastId });
                    } else if (successful === 0) {
                        toast.error(`Failed to add all ${failed} products`, { id: toastId });
                    } else {
                        toast.warning(`Added ${successful} products, ${failed} failed`, { id: toastId });
                    }

                    if (onSuccess) onSuccess();
                } else {
                    throw new Error(data.detail || 'Failed to add products');
                }
            } else {
                // Use single endpoint for backward compatibility
                const res = await fetch(`/api/sync/product`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        identifier: identifiers[0],
                        by_handle: byHandle,
                        brand_id: currentBrand.id
                    })
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    toast.success(`Product "${data.product.title}" added successfully!`, { id: toastId });
                    setShowModal(false);
                    setIdentifier('');
                    if (onSuccess) onSuccess();
                } else {
                    throw new Error(data.detail || 'Failed to add product');
                }
            }
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setShowResults(false);
        setIdentifier('');
        setBatchResults(null);
    };

    const identifierCount = identifier
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0).length;

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="btn bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg hover:shadow-xl hover:bg-primary/90 flex items-center gap-2 transition-all"
            >
                <Plus size={18} />
                Add from Shopify
            </button>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !loading && closeModal()}></div>

                    {!showResults ? (
                        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">Add Product from Shopify</h2>
                                    <p className="text-sm text-gray-500 mt-1">Enter Product ID(s) or Handle(s)</p>
                                </div>
                                <button
                                    onClick={() => !loading && closeModal()}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                    disabled={loading}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleAddProduct} className="space-y-4">
                                {/* Toggle between ID and Handle */}
                                <div className="flex gap-4 p-3 bg-gray-50 rounded-lg">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={!byHandle}
                                            onChange={() => setByHandle(false)}
                                            className="text-primary focus:ring-primary"
                                            disabled={loading}
                                        />
                                        <span className="text-sm font-medium">Product ID</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={byHandle}
                                            onChange={() => setByHandle(true)}
                                            className="text-primary focus:ring-primary"
                                            disabled={loading}
                                        />
                                        <span className="text-sm font-medium">Handle</span>
                                    </label>
                                </div>

                                {/* Input Field */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {byHandle ? 'Product Handle(s)' : 'Product ID(s)'}
                                    </label>
                                    <textarea
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        placeholder={byHandle
                                            ? 'e.g., mens-cotton-t-shirt, womens-denim-jeans'
                                            : 'e.g., 8876718719192, 8876718719193, 8876718719194'}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                                        disabled={loading}
                                        autoFocus
                                        rows={3}
                                    />
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-xs text-gray-500">
                                            Separate multiple {byHandle ? 'handles' : 'IDs'} with commas
                                        </p>
                                        {identifierCount > 0 && (
                                            <span className="text-xs font-medium text-primary">
                                                {identifierCount} product{identifierCount > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                        disabled={loading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={loading || identifierCount === 0}
                                    >
                                        {loading ? 'Adding...' : `Add ${identifierCount > 1 ? `${identifierCount} Products` : 'Product'}`}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in duration-200 max-h-[80vh] flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">Batch Import Results</h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {batchResults?.summary.successful} successful, {batchResults?.summary.failed} failed
                                    </p>
                                </div>
                                <button
                                    onClick={closeModal}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-blue-700">{batchResults?.summary.total}</div>
                                    <div className="text-xs text-blue-600">Total</div>
                                </div>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-green-700">{batchResults?.summary.successful}</div>
                                    <div className="text-xs text-green-600">Successful</div>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-red-700">{batchResults?.summary.failed}</div>
                                    <div className="text-xs text-red-600">Failed</div>
                                </div>
                            </div>

                            {/* Results List */}
                            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                                {batchResults?.results.map((result, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-lg border ${result.success
                                            ? 'bg-green-50 border-green-200'
                                            : 'bg-red-50 border-red-200'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {result.success ? (
                                                <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <XCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm text-gray-900 truncate">
                                                    {result.success ? result.product?.title : result.identifier}
                                                </div>
                                                <div className={`text-xs mt-1 ${result.success ? 'text-green-700' : 'text-red-700'
                                                    }`}>
                                                    {result.message}
                                                </div>
                                                {result.success && (
                                                    <div className="text-xs text-gray-500 mt-1 font-mono">
                                                        ID: {result.identifier}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={closeModal}
                                className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
