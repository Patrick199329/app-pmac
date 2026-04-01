import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../services/supabase';
import LoadingOverlay from './LoadingOverlay';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
    const [status, setStatus] = useState({
        loading: true,
        authorized: false
    });

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    if (isMounted) setStatus({ loading: false, authorized: false });
                    return;
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (!profile) {
                    if (isMounted) setStatus({ loading: false, authorized: false });
                    return;
                }

                const isAdmin = profile.role === 'ADMIN';
                const isPartner = profile.role === 'PARTNER';

                // Admin/Partner requirement check
                if (requireAdmin && !isAdmin && !isPartner) {
                    if (isMounted) setStatus({ loading: false, authorized: false });
                    return;
                }

                // Internal staff (Admin/Partner) are authorized for everything they can see
                if (isAdmin || isPartner) {
                    if (isMounted) setStatus({ loading: false, authorized: true });
                    return;
                }
                
                // Standard user pass check logic follows...
                const { data: passes } = await supabase
                    .from('access_passes')
                    .select('created_at')
                    .eq('user_id', user.id)
                    .eq('status', 'ACTIVE')
                    .order('created_at', { ascending: false })
                    .limit(1);

                const latestPass = passes?.[0];
                if (!latestPass) {
                    if (isMounted) setStatus({ loading: false, authorized: false });
                    return;
                }

                const grantDate = new Date(latestPass.created_at);
                const thirtyDays = 30 * 24 * 60 * 60 * 1000;
                if (new Date() - grantDate >= thirtyDays) {
                    if (isMounted) setStatus({ loading: false, authorized: false });
                    return;
                }

                if (isMounted) setStatus({ loading: false, authorized: true });

            } catch (err) {
                console.error("[Auth] Error:", err);
                if (isMounted) setStatus({ loading: false, authorized: false });
            }
        };

        checkAuth();
        return () => { isMounted = false; };
    }, [requireAdmin]); // Run once on mount or when requirement type changes

    if (status.loading) return <LoadingOverlay message="Verificando Acesso..." />;

    if (!status.authorized) {
        return <Navigate to="/access" replace />;
    }

    return children ? children : <Outlet />;
};

export default ProtectedRoute;
