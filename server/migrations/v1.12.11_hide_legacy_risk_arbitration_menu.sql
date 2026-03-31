UPDATE sys_menus
SET
    visible = false,
    updated_at = NOW()
WHERE path = '/risk/arbitration'
   OR component = 'pages/risk/ArbitrationCenter';
