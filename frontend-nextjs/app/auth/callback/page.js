'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            try {
                console.log('=== Auth Callback Started ===');
                console.log('Full URL:', window.location.href);

                // Supabase automatically handles the OAuth callback via onAuthStateChange
                // We just need to wait for the session to be established
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('Auth callback error:', error);
                    alert(`Authentication error: ${error.message}`);
                    router.push('/login');
                    return;
                }

                if (session) {
                    console.log('✅ Session established successfully! User:', session.user?.email);
                    console.log('Redirecting to home...');
                    router.push('/');
                } else {
                    // Wait a bit for Supabase to process the hash token
                    console.log('Waiting for session to be established...');
                    setTimeout(async () => {
                        const { data: { session: retrySession } } = await supabase.auth.getSession();
                        if (retrySession) {
                            console.log('✅ Session established! User:', retrySession.user?.email);
                            router.push('/');
                        } else {
                            console.warn('No session found after OAuth redirect');
                            router.push('/login');
                        }
                    }, 1000);
                }

            } catch (error) {
                console.error('Callback exception:', error);
                alert(`Callback error: ${error.message}`);
                router.push('/login');
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Completing sign in...</p>
                <p className="text-xs text-gray-400 mt-2">This should only take a moment</p>
            </div>
        </div>
    );
}
