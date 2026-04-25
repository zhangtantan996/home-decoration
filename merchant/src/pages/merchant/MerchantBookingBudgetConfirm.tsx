import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

const MerchantBookingBudgetConfirm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <Navigate to="/bookings" replace />;
  }
  return <Navigate to={`/proposals/flow/${id}?step=budget&mode=edit`} replace />;
};

export default MerchantBookingBudgetConfirm;
