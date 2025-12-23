import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

const BrandContext = createContext({});

export const BrandProvider = ({ children }) => {
    const { user } = useAuth();
    const [brands, setBrands] = useState([]);
    const [currentBrand, setCurrentBrand] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();
    const navigate = useNavigate();

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
            const pathParts = location.pathname.split('/');
            const potentialBrandCode = pathParts[1]; // Index 0 is empty string

            if (potentialBrandCode && potentialBrandCode !== 'login' && potentialBrandCode !== '') {
                const brand = brands.find(b => b.code === potentialBrandCode);
                if (brand) {
                    if (currentBrand?.id !== brand.id) {
                        setCurrentBrand(brand);
                    }
                } else if (location.pathname !== '/') {
                    // Invalid brand code in URL, maybe redirect to selection?
                    // Only if not at root
                    console.warn("Invalid brand code in URL:", potentialBrandCode);
                }
            } else {
                setCurrentBrand(null);
            }
        }
    }, [location.pathname, brands, loading]);

    const loadBrands = async () => {
        try {
            const { data, error } = await supabase.from('brands').select('*');
            if (error) throw error;
            setBrands(data);
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
