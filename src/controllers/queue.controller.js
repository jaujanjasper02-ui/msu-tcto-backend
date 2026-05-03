import { supabase } from '../config/supabase.js';

// =============================================
// DAILY LIMIT CONFIGURATION
// =============================================
const DAILY_LIMIT = 100;

// =============================================
// HELPER: GET PHILIPPINE DATE
// =============================================
const getPHDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// =============================================
// GET QUEUE STATUS (for Dashboard)
// ✅ DAPAT WALANG DEPARTMENT FILTER - GLOBAL QUEUE
// =============================================
export const getQueueStatus = async (req, res) => {
  try {
    const today = getPHDate();
    
    // Get current serving (the smallest queue_number with status processing or ready)
    const { data: currentServing, error: servingError } = await supabase
      .from('requests')
      .select('queue_number')
      .eq('queue_date', today)
      .in('status', ['processing', 'ready'])
      .order('queue_number', { ascending: true })
      .limit(1);
    
    if (servingError) throw servingError;
    
    // Get last issued queue number (largest queue_number for today)
    const { data: lastQueue, error: lastError } = await supabase
      .from('requests')
      .select('queue_number')
      .eq('queue_date', today)
      .not('status', 'in', '("rejected","claimed")')
      .order('queue_number', { ascending: false })
      .limit(1);
    
    if (lastError) throw lastError;
    
    // ✅ IDAGDAG: Get pending count (for wait time calculation)
    const { count: pendingCount, error: pendingError } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('queue_date', today)
      .not('status', 'in', '("rejected","claimed")');
    
    if (pendingError) throw pendingError;
    
    // Get total requests today
    const { count: totalToday, error: countError } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('queue_date', today);
    
    if (countError) throw countError;
    
    console.log('📊 Queue Status Response:', {
      current_serving: currentServing?.[0]?.queue_number || null,
      last_queue_number: lastQueue?.[0]?.queue_number || null,
      pending_count: pendingCount || 0,
      total_requests_today: totalToday || 0
    });
    
    res.json({
      success: true,
      current_serving: currentServing?.[0]?.queue_number || null,
      last_queue_number: lastQueue?.[0]?.queue_number || null,
      pending_count: pendingCount || 0,
      total_requests_today: totalToday || 0,
      queue_limit: DAILY_LIMIT,
      is_limit_reached: (totalToday || 0) >= DAILY_LIMIT,
      last_updated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching queue status:', error);
    res.status(500).json({ error: error.message });
  }
};