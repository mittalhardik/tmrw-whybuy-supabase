'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { usePathname, useRouter } from 'next/navigation';

const BrandContext = createContext({});

export const BrandProvider = ({ children }) => {
    const { user } = useAuth();
    const [brands, setBrands] = useState([]);
    const [currentBrand, setCurrentBrand] = useState(null);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();
    const router = useRouter();

    // Load brands on mount
    useEffect(() => {
        if (user) {
            loadBrands();
        }
    }, [user]);

    // Sync currentBrand with URL
    useEffect(() => {
        if (!loading && brands.length > 0) {
            // Extract brand code from path: /:brandCode/...
            const pathParts = pathname.split('/');
            const potentialBrandCode = pathParts[1]; // Index 0 is empty string

            if (potentialBrandCode && potentialBrandCode !== 'login' && potentialBrandCode !== '') {
                const brand = brands.find(b => b.code === potentialBrandCode);
                if (brand) {
                    if (currentBrand?.id !== brand.id) {
                        setCurrentBrand(brand);
                    }
                } else if (pathname !== '/') {
                    // Invalid brand code in URL, maybe redirect to selection?
                    // Only if not at root
                    console.warn("Invalid brand code in URL:", potentialBrandCode);
                }
            } else {
                setCurrentBrand(null);
            }
        }
    }, [pathname, brands, loading]);

    const loadBrands = async () => {
        try {
            const { data: brandsData, error } = await supabase.from('brands').select('*');
            if (error) throw error;

            let finalBrands = brandsData;

            // Fetch user permissions
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('allowed_brands')
                .eq('id', user.id)
                .single();

            if (!userError && userData) {
                // If user record exists, strictly filter
                const allowed = userData.allowed_brands || [];
                finalBrands = brandsData.filter(b => allowed.includes(b.code));
            }

            setBrands(finalBrands);
        } catch (error) {
            console.error('Error loading brands:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <BrandContext.Provider value={{ brands, currentBrand, setCurrentBrand, loading }}>
            {!loading && children}
        </BrandContext.Provider>
    );
};

export const useBrand = () => {
    return useContext(BrandContext);
};
