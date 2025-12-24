// ========================================
// FRONTEND FLAGGING UI - MANUAL UPDATE REQUIRED
// ========================================
// File: frontend-nextjs/app/[brandCode]/products/[productId]/page.js
// Location: Lines ~444-510 (Ecommerce Images Section)
//
// Replace the existing ecommerce images map with this code:
// ========================================

{
    outputs.step4_ecommerce_images?.ecommerce_images?.map((img, i) => (
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
                    {/* ...existing attribute display code... */}

                    {/* Actions - ADD THIS SECTION */}
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
    ))
}

// ========================================
// KEY CHANGES TO MAKE:
// ========================================
// 1. Add to outer div className: ${img.flagged ? 'border-2 border-orange-500' : 'border'}
// 2. Add to img className: ${img.flagged ? 'opacity-75' : ''}
// 3. Add flagged badge after <img> tag:
//    {img.flagged && <div className="absolute top-2 left-2 bg-orange-500 text-white...">...}
// 4. Replace "Download Link" div with new "Actions" div containing:
//    - Flag/Unflag button
//    - Download button
//
// REPEAT FOR LOOKBOOK IMAGES SECTION (similar pattern)
