import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMerchantAuthStore } from '../stores/merchantAuthStore';

export default function MerchantAuthGuard() {
    const isAuthenticated = useMerchantAuthStore((state) => state.isAuthenticated);
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return <Outlet />;
}
