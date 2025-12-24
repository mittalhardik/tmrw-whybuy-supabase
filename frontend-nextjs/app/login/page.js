'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
    const auth = useAuth();
    const router = useRouter();

    // Debug logging
    console.log('Login page - auth object:', auth);
    console.log('Login page - signInWithGoogle available:', !!auth?.signInWithGoogle);

    const { user, signInWithGoogle } = auth || {};

    useEffect(() => {
        if (user) {
            router.push('/');
        }
    }, [user, router]);

    const handleGoogleSignIn = async () => {
        if (!signInWithGoogle) {
            console.error('signInWithGoogle is not available! Auth object:', auth);
            alert('Authentication not initialized. Please refresh the page.');
            return;
        }

        try {
            console.log('Attempting Google sign-in...');
            const result = await signInWithGoogle();
            console.log('Sign-in result:', result);

            if (result?.error) {
                console.error('Sign-in error:', result.error);
                alert('Sign-in failed: ' + result.error.message);
            }
        } catch (error) {
            console.error('Unexpected sign-in error:', error);
            alert('Sign-in failed. Please check console for details.');
        }
    };

    if (user) {
        return null;
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Or contact support if you don't have access
                    </p>
                </div>
                <div className="mt-8 space-y-6">
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={!signInWithGoogle}
                        className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {signInWithGoogle ? 'Sign in with Google' : 'Loading...'}
                    </button>
                    {!signInWithGoogle && (
                        <p className="text-xs text-red-500 text-center">Auth not initialized. Check console.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
