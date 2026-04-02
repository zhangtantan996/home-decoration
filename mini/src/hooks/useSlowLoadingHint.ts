import { useEffect, useState } from 'react';

export const useSlowLoadingHint = (loading: boolean, delay = 1000) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, loading]);

  return visible;
};

export default useSlowLoadingHint;
