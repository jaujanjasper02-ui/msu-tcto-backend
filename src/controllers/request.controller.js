import { supabase } from '../config/supabase.js';

const DAILY_LIMIT = 100;

const getPHDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayDate = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getNextQueueNumber = async () => {
  const today = getPHDate();
  const yesterday = getYesterdayDate();
  
  const { data: yesterdayUnfinished } = await supabase
    .from('requests')
    .select('queue_number')
    .eq('queue_date', yesterday)
    .not('status', 'in', '("claimed","rejected")')
    .order('queue_number', { ascending: false })
    .limit(1);
  
  if (yesterdayUnfinished && yesterdayUnfinished.length > 0) {
    const highestUnfinished = yesterdayUnfinished[0].queue_number;
    
    const { data: todayRequests } = await supabase
      .from('requests')
      .select('queue_number')
      .eq('queue_date', today)
      .order('queue_number', { ascending: false })
      .limit(1);
    
    if (todayRequests && todayRequests.length > 0) {
      return todayRequests[0].queue_number + 1;
    } else {
      return highestUnfinished + 1;
    }
  }
  
  const { data, error } = await supabase
    .from('requests')
    .select('queue_number')
    .eq('queue_date', today)
    .not('status', 'in', '("rejected","claimed")')
    .order('queue_number', { ascending: false })
    .limit(1);
  
  if (error || !data || data.length === 0 || !data[0].queue_number) {
    return 1;
  }
  
  return data[0].queue_number + 1;
};

const checkDailyRequestLimit = async (userId) => {
  const today = getPHDate();
  
  const { count, error } = await supabase
    .from('requests')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', userId)
    .eq('queue_date', today);
  
  if (error) {
    return { allowed: true, count: 0, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };
  }
  
  const remaining = DAILY_LIMIT - (count || 0);
  
  return {
    allowed: remaining > 0,
    count: count || 0,
    remaining: remaining,
    limit: DAILY_LIMIT
  };
};

const getNextAvailableDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const sendDailyLimitNotification = async (email, name, limitCheck) => {
  const subject = 'Daily Request Limit Reached - MSU-TCTO REQUEST';
  const nextDate = getNextAvailableDate();
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #7A0019;">MSU-TCTO Registrar</h2>
        <p style="color: #666;">Mindanao State University - Tawi-Tawi</p>
      </div>
      <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; border-left: 4px solid #ff9800;">
        <h3 style="color: #e65100;">⚠️ Daily Request Limit Reached</h3>
        <p>Dear ${name},</p>
        <p>You have reached the daily limit of <strong>${limitCheck.limit} requests</strong>.</p>
        <div style="background-color: #fff; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>📊 Your requests today:</strong> ${limitCheck.count} / ${limitCheck.limit}</p>
          <p><strong>📅 Next available date:</strong> ${nextDate}</p>
        </div>
        <p>Your request will be processed starting tomorrow.</p>
      </div>
    </div>
  `;
  
  try {
    const { sendEmail } = await import('../config/email.js');
    await sendEmail(email, subject, html);
  } catch (err) {
    console.error('Failed to send limit notification:', err);
  }
};

function generateTrackingCode() {
  const datePart = getPHDate().replace(/-/g, '');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${datePart}-${randomPart}`;
}

export const getPendingCount = async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: count || 0
    });
  } catch (err) {
    console.error('Get pending count error:', err);
    res.status(500).json({ message: 'Failed to get pending count' });
  }
};

export const createRequest = async (req, res) => {
  try {
    const {
      category,
      request_type,
      purpose,
      additional_remarks,
      copies = 1,
      processing_days
    } = req.body;

    const { userId } = req.user;

    if (!processing_days || processing_days < 1) {
      return res.status(400).json({ 
        message: 'Processing days is required and must be at least 1' 
      });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id_number, first_name, last_name, role, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const limitCheck = await checkDailyRequestLimit(userId);
    
    if (!limitCheck.allowed) {
      await sendDailyLimitNotification(user.email, user.first_name, limitCheck);
      
      return res.status(429).json({ 
        success: false,
        message: `Daily limit reached. You have made ${limitCheck.count} out of ${limitCheck.limit} requests today.`,
        limitReached: true,
        dailyLimit: limitCheck.limit,
        requestsToday: limitCheck.count,
        nextAvailableDate: getNextAvailableDate()
      });
    }

    const tracking_code = generateTrackingCode();
    const today = getPHDate();
    const queueNumber = await getNextQueueNumber();
    
    const estimated_completion = new Date();
    estimated_completion.setDate(estimated_completion.getDate() + processing_days);
    const estimated_completion_iso = estimated_completion.toISOString();

    const getFeeForDocument = (requestType) => {
      const feeMap = {
        'Transcript of Records (TOR)': 50.00,
        'Authentication': 50.00,
        'Transfer Credential/Honorable Dismissal': 50.00,
        'Report of Grade (ROG)': 20.00,
        'Evaluation of Grades': 20.00,
        'Certificate of Registration(COR)': 5.00,
        'Reprinting Fee and (Grade)': 5.00,
        'Certificate of Grade by semester Reprinting': 5.00,
        'Certification': 50.00,
        'CAV': 150.00,
        'University Clearance Form': 5.00,
        'INC Form': 20.00,
        'Advance Credit/s Form and Substitution Form': 20.00,
        'Application for Graduation Form': 50.00
      };
      return feeMap[requestType] || 0.00;
    };

    const feePerCopy = getFeeForDocument(request_type);
    const totalFee = feePerCopy * copies;

    const { data, error } = await supabase.from('requests').insert([{
      sender_id: userId,
      sender_id_number: user.id_number,
      sender_name: `${user.first_name} ${user.last_name}`,
      category,
      request_type,
      purpose: purpose || 'Not specified',
      additional_remarks: additional_remarks || '',
      copies,
      tracking_code,
      status: 'pending',
      estimated_completion_date: estimated_completion_iso,
      queue_number: queueNumber,
      queue_date: today,
      date_sent: new Date().toISOString()
    }]).select().single();

    if (error) {
      console.error('Insert error:', error);
      throw error;
    }

    res.status(201).json({
      success: true,
      request_id: data.id,
      tracking_code: data.tracking_code,
      request_type: data.request_type,
      purpose: data.purpose,
      copies: data.copies,
      date_submitted: data.date_sent,
      fee: `₱${totalFee.toFixed(2)}`,
      processing_days: processing_days,
      estimated_completion: {
        iso: estimated_completion_iso,
        formatted: estimated_completion.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      },
      queue_number: queueNumber,
      message: 'Request submitted successfully'
    });

  } catch (err) {
    console.error('Create request error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const trackRequestByCode = async (req, res) => {
  try {
    const { tracking_code } = req.params;

    if (!tracking_code) {
      return res.status(400).json({ message: 'Tracking code is required' });
    }

    const { data, error } = await supabase
      .from('requests')
      .select('tracking_code, status, request_type, category, date_sent, copies, purpose, additional_remarks, queue_number, estimated_completion_date')
      .eq('tracking_code', tracking_code)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json({
      tracking_code: data.tracking_code,
      status: data.status,
      request_type: data.request_type,
      category: data.category,
      date_submitted: data.date_sent,
      copies: data.copies,
      purpose: data.purpose,
      additional_remarks: data.additional_remarks,
      estimated_completion: data.estimated_completion_date,
      queue_number: data.queue_number
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, startDate, endDate } = req.query;
    const user = req.user;

    let query = supabase.from('requests').select('*', { count: 'exact' });

    if (user.role !== 'super_admin') {
      query = query.eq('department', user.department);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('date_sent', startDate);
    }

    if (endDate) {
      query = query.lte('date_sent', endDate);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: requests, error, count } = await query
      .order('queue_date', { ascending: true })
      .order('queue_number', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const senderIds = requests.map(req => req.sender_id).filter(Boolean);
    let usersMap = {};
    if (senderIds.length > 0) {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, id_number, first_name, last_name, role')
        .in('id', senderIds);
      
      if (!userError && users) {
        usersMap = users.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {});
      }
    }

    const formatDateShort = (dateString) => {
      if (!dateString) return '—';
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getFeeForDocument = (requestType) => {
      const feeMap = {
        'Transcript of Records (TOR)': 50.00,
        'Authentication': 50.00,
        'Transfer Credential/Honorable Dismissal': 50.00,
        'Report of Grade (ROG)': 20.00,
        'Evaluation of Grades': 20.00,
        'Certificate of Registration(COR)': 5.00,
        'Reprinting Fee and (Grade)': 5.00,
        'Certificate of Grade by semester Reprinting': 5.00,
        'Certification': 50.00,
        'CAV': 150.00,
        'University Clearance Form': 5.00,
        'INC Form': 20.00,
        'Advance Credit/s Form and Substitution Form': 20.00,
        'Application for Graduation Form': 50.00
      };
      return feeMap[requestType] || 0.00;
    };

    const transformedRequests = requests.map(request => {
      const userData = usersMap[request.sender_id] || {};
      const studentType = userData.role === 'alumni' ? 'Alumni' : 'Student';
      
      return {
        id: request.tracking_code || `REQ-${request.id}`,
        student: request.sender_name || `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
        idNumber: request.sender_id_number || userData.id_number || '—',
        studentType: studentType,
        document: request.request_type,
        date: request.date_sent,
        status: request.status,
        copies: request.copies,
        department: request.department || 'CCS',  // ✅ IMPORTANT: Add this!
        queue_number: request.queue_number,
        queue_date: request.queue_date
      };
    });

    let statsQuery = supabase.from('requests').select('*');
    if (user.role !== 'super_admin') {
      statsQuery = statsQuery.eq('department', user.department);
    }
    const { data: allRequestsForStats } = await statsQuery;
    
    const stats = {
      totalRequests: allRequestsForStats?.length || 0,
      pending: allRequestsForStats?.filter(r => r.status === 'pending').length || 0,
      processing: allRequestsForStats?.filter(r => r.status === 'processing' || r.status === 'approved').length || 0,
      ready: allRequestsForStats?.filter(r => r.status === 'ready').length || 0,
      claimed: allRequestsForStats?.filter(r => r.status === 'claimed').length || 0,
      rejected: allRequestsForStats?.filter(r => r.status === 'rejected').length || 0
    };

    res.status(200).json({
      requests: transformedRequests,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (err) {
    console.error('Error in getAllRequests:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let query = supabase.from('requests').select('*');
    
    if (isUUID) {
      query = query.eq('id', id);
    } else {
      query = query.eq('tracking_code', id);
    }

    const { data: request, error: requestError } = await query.single();

    if (requestError || !request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && request.sender_id !== userId) {
      return res.status(403).json({ message: 'You are not authorized to view this request' });
    }

    let userData = null;
    if (request.sender_id) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id_number, first_name, last_name, middle_name, email, department, course, year_level, year_graduated, role')
        .eq('id', request.sender_id)
        .single();

      if (!userError && user) {
        userData = user;
      }
    }

    const formatDateFull = (dateString) => {
      if (!dateString) return null;
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const studentType = userData?.role === 'student' ? 'Student' : 
                       userData?.role === 'alumni' ? 'Alumni' : 'Student';

    const getFeeForDocument = (requestType) => {
      const feeMap = {
        'Transcript of Records (TOR)': 50.00,
        'Authentication': 50.00,
        'Transfer Credential/Honorable Dismissal': 50.00,
        'Report of Grade (ROG)': 20.00,
        'Evaluation of Grades': 20.00,
        'Certificate of Registration(COR)': 5.00,
        'Reprinting Fee and (Grade)': 5.00,
        'Certificate of Grade by semester Reprinting': 5.00,
        'Certification': 50.00,
        'CAV': 150.00,
        'University Clearance Form': 5.00,
        'INC Form': 20.00,
        'Advance Credit/s Form and Substitution Form': 20.00,
        'Application for Graduation Form': 50.00
      };
      return feeMap[requestType] || 0.00;
    };

    const response = {
      id: request.tracking_code,
      uuid: request.id,
      tracking_code: request.tracking_code,
      status: request.status,
      category: request.category,
      documentType: request.request_type,
      purpose: request.purpose,
      copies: request.copies,
      studentName: request.sender_name || (userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() : ''),
      studentId: userData?.id_number || request.sender_id_number || '',
      studentType: studentType,
      course: userData?.course || '',
      yearLevel: userData?.year_level || '',
      yearGraduated: userData?.year_graduated || '',
      department: userData?.department || '',
      email: userData?.email || '—',
      requestDate: formatDateFull(request.date_sent),
      amount: (getFeeForDocument(request.request_type) * request.copies).toFixed(2),
      additional_remarks: request.additional_remarks || '',
      estimated_completion_date: formatDateFull(request.estimated_completion_date),
      queue_number: request.queue_number,
      queue_date: request.queue_date
    };

    res.status(200).json(response);

  } catch (err) {
    console.error('Get request by ID error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const searchRequests = async (req, res) => {
  try {
    const { q } = req.query;
    const { page = 1, limit = 10 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const searchTerm = q.trim();

    let query = supabase.from('requests').select('*');
    const conditions = [];
    
    if (searchTerm.match(/^REQ-\d{8}-\d{4}$/)) {
      conditions.push(`tracking_code.eq.${searchTerm}`);
    }
    conditions.push(`tracking_code.ilike.%${searchTerm}%`);
    conditions.push(`request_type.ilike.%${searchTerm}%`);
    conditions.push(`purpose.ilike.%${searchTerm}%`);
    conditions.push(`sender_name.ilike.%${searchTerm}%`);
    conditions.push(`sender_id_number.ilike.%${searchTerm}%`);

    query = query.or(conditions.join(','));

    const { data: requests, error } = await query.order('date_sent', { ascending: false });
    if (error) throw error;

    const { data: userMatches } = await supabase
      .from('users')
      .select('id, first_name, last_name, id_number, role')
      .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,id_number.ilike.%${searchTerm}%`);

    let userBasedRequests = [];
    if (userMatches && userMatches.length > 0) {
      const userIds = userMatches.map(u => u.id);
      const { data: extraRequests } = await supabase
        .from('requests')
        .select('*')
        .in('sender_id', userIds)
        .order('date_sent', { ascending: false });
      if (extraRequests) userBasedRequests = extraRequests;
    }

    const userMap = {};
    if (userMatches) {
      userMatches.forEach(user => { userMap[user.id] = user; });
    }

    const allRequests = [...requests, ...userBasedRequests];
    const uniqueRequests = Array.from(new Map(allRequests.map(item => [item.id, item])).values());

    const formatDateShort = (dateString) => {
      if (!dateString) return '—';
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const transformedRequests = uniqueRequests.map(request => {
      const user = userMap[request.sender_id] || {};
      let studentType = 'Student';
      if (user.role === 'alumni') studentType = 'Alumni';

      return {
        id: request.tracking_code || `REQ-${request.id}`,
        student: request.sender_name || (user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Unknown'),
        idNumber: request.sender_id_number || user.id_number || '—',
        studentType: studentType,
        document: request.request_type,
        date: formatDateShort(request.date_sent),
        status: request.status,
        purpose: request.purpose,
        copies: request.copies || 1,
        queue_number: request.queue_number,
        queue_date: request.queue_date
      };
    });

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedResults = transformedRequests.slice(startIndex, endIndex);

    res.status(200).json({
      query: searchTerm,
      total: transformedRequests.length,
      page: parseInt(page),
      limit: parseInt(limit),
      results: paginatedResults,
      stats: { totalMatches: transformedRequests.length, showing: paginatedResults.length }
    });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getUserRequests = async (req, res) => {
  try {
    const { userId } = req.user;
    const { status, page = 1, limit = 10 } = req.query;

    let query = supabase
      .from('requests')
      .select('tracking_code, request_type, status, date_sent, queue_number, queue_date', { count: 'exact' })
      .eq('sender_id', userId);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: requests, error, count } = await query
      .order('queue_date', { ascending: true })
      .order('queue_number', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const formatDateShort = (dateString) => {
      if (!dateString) return '—';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    const transformedRequests = requests.map(request => ({
      tracking_code: request.tracking_code,
      document: request.request_type,
      status: request.status,
      date_submitted: formatDateShort(request.date_sent),
      queue_number: request.queue_number,
      queue_date: request.queue_date
    }));

    const { data: stats } = await supabase
      .from('requests')
      .select('status')
      .eq('sender_id', userId);

    const statusCounts = {
      pending: stats?.filter(r => r.status === 'pending').length || 0,
      processing: stats?.filter(r => r.status === 'processing' || r.status === 'approved').length || 0,
      ready: stats?.filter(r => r.status === 'ready').length || 0,
      claimed: stats?.filter(r => r.status === 'claimed').length || 0,
      rejected: stats?.filter(r => r.status === 'rejected').length || 0,
      total: count || 0
    };

    res.status(200).json({
      requests: transformedRequests,
      stats: statusCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (err) {
    console.error('Get user requests error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getUserRequestDetails = async (req, res) => {
  try {
    const { trackingCode } = req.params;
    const { userId } = req.user;

    const { data: request, error } = await supabase
      .from('requests')
      .select(`
        tracking_code,
        request_type,
        status,
        date_sent,
        copies,
        estimated_completion_date,
        processed_date,
        ready_date,
        claimed_date,
        rejected_date,
        rejected_reason,
        queue_number,
        queue_date
      `)
      .eq('tracking_code', trackingCode)
      .eq('sender_id', userId)
      .single();

    if (error || !request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const formatDateLong = (dateString) => {
      if (!dateString) return null;
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const response = {
      tracking_code: request.tracking_code,
      request_type: request.request_type,
      status: request.status,
      date_sent: formatDateLong(request.date_sent),
      copies: request.copies,
      estimated_completion_date: formatDateLong(request.estimated_completion_date),
      processed_date: formatDateLong(request.processed_date),
      ready_date: formatDateLong(request.ready_date),
      claimed_date: formatDateLong(request.claimed_date),
      rejected_date: formatDateLong(request.rejected_date),
      rejected_reason: request.rejected_reason || null,
      queue_number: request.queue_number,
      queue_date: request.queue_date
    };

    res.status(200).json(response);

  } catch (err) {
    console.error('Get user request details error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getAllandallRequests = async (req, res) => {
  try {
    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .select('*')
      .order('queue_date', { ascending: true })
      .order('queue_number', { ascending: true });

    if (requestsError) throw requestsError;

    if (!requests || requests.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        requests: []
      });
    }

    const senderIds = [...new Set(requests.map(r => r.sender_id).filter(Boolean))];

    let usersMap = {};
    if (senderIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, id_number, first_name, last_name, middle_name, role, year_level, year_graduated, department, course, email')
        .in('id', senderIds);
      
      if (!usersError && users) {
        usersMap = users.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {});
      }
    }

    const transformedRequests = requests.map(request => {
      const user = usersMap[request.sender_id];
      
      return {
        id: request.id,
        tracking_code: request.tracking_code,
        category: request.category,
        request_type: request.request_type,
        purpose: request.purpose,
        additional_remarks: request.additional_remarks,
        copies: request.copies,
        status: request.status,
        date_sent: request.date_sent,
        estimated_completion_date: request.estimated_completion_date,
        payment_status: request.payment_status,
        or_number: request.or_number,
        approved_date: request.approved_date,
        processed_date: request.processed_date,
        ready_date: request.ready_date,
        claimed_date: request.claimed_date,
        rejected_date: request.rejected_date,
        rejected_reason: request.rejected_reason,
        status_history: request.status_history,
        sender_name: request.sender_name,
        sender_id_number: request.sender_id_number,
        queue_number: request.queue_number,
        queue_date: request.queue_date,
        user: user ? {
          id: user.id,
          id_number: user.id_number,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          first_name: user.first_name,
          last_name: user.last_name,
          middle_name: user.middle_name,
          role: user.role,
          year_level: user.role === 'student' ? user.year_level : null,
          year_graduated: user.role === 'alumni' ? user.year_graduated : null,
          department: user.department,
          course: user.course,
          email: user.email
        } : null
      };
    });

    res.status(200).json({
      success: true,
      count: transformedRequests.length,
      requests: transformedRequests
    });

  } catch (err) {
    console.error('Error fetching all requests:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

export const exportRequestsToCSV = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let query = supabase
      .from('requests')
      .select(`
        tracking_code,
        sender_name,
        sender_id_number,
        request_type,
        copies,
        status,
        date_sent,
        queue_number,
        purpose
      `);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (startDate) {
      query = query.gte('date_sent', startDate);
    }
    if (endDate) {
      query = query.lte('date_sent', endDate);
    }

    const { data: requests, error } = await query.order('date_sent', { ascending: false });

    if (error) throw error;

    if (!requests || requests.length === 0) {
      return res.status(404).json({ message: 'No data to export' });
    }

    const getFeeForDocument = (requestType) => {
      const feeMap = {
        'Transcript of Records (TOR)': 50.00,
        'Authentication': 50.00,
        'Transfer Credential/Honorable Dismissal': 50.00,
        'Report of Grade (ROG)': 20.00,
        'Evaluation of Grades': 20.00,
        'Certificate of Registration(COR)': 5.00,
        'Reprinting Fee and (Grade)': 5.00,
        'Certificate of Grade by semester Reprinting': 5.00,
        'Certification': 50.00,
        'CAV': 150.00,
        'University Clearance Form': 5.00,
        'INC Form': 20.00,
        'Advance Credit/s Form and Substitution Form': 20.00,
        'Application for Graduation Form': 50.00
      };
      return feeMap[requestType] || 0.00;
    };

    const headers = [
      'Tracking Code',
      'Student Name',
      'Student ID',
      'Document Type',
      'Copies',
      'Status',
      'Date Submitted',
      'Queue Number',
      'Total Fee',
      'Purpose'
    ];

    const rows = requests.map(req => {
      const feePerCopy = getFeeForDocument(req.request_type);
      const totalFee = (feePerCopy * (req.copies || 1)).toFixed(2);
      
      return [
        req.tracking_code || '',
        req.sender_name || '',
        req.sender_id_number || '',
        req.request_type || '',
        req.copies || 1,
        req.status || '',
        new Date(req.date_sent).toLocaleDateString('en-PH'),
        req.queue_number || 'N/A',
        `₱${totalFee}`,
        req.purpose || 'Not specified'
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;
    const fileName = `requests_export_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(csvWithBom);

  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ message: 'Failed to export data' });
  }
};