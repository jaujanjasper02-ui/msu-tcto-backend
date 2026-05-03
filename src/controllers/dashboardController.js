import { supabase } from '../config/supabase.js';

// =============================================
// GET DASHBOARD STATISTICS (FIXED - USING USERS TABLE FOR COURSE/DEPT)
// =============================================
export const getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats...');

    // Get all requests
    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .select('*');

    if (requestsError) {
      console.error('❌ Requests query error:', requestsError);
      throw requestsError;
    }

    // Get all users separately (for course, department, year level)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, role, year_level, course, department, first_name, last_name');

    if (usersError) {
      console.error('❌ Users query error:', usersError);
      throw usersError;
    }

    console.log(`✅ Found ${requests?.length || 0} requests, ${users?.length || 0} users`);

    // Create user map for quick lookup
    const userMap = new Map();
    users?.forEach(user => {
      userMap.set(user.id, user);
    });

    // =============================================
    // BASIC STATS (from requests table)
    // =============================================
    const total = requests?.length || 0;
    const pending = requests?.filter(r => r.status === 'pending').length || 0;
    const processing = requests?.filter(r => r.status === 'processing' || r.status === 'approved').length || 0;
    const ready = requests?.filter(r => r.status === 'ready').length || 0;
    const claimed = requests?.filter(r => r.status === 'claimed').length || 0;
    const rejected = requests?.filter(r => r.status === 'rejected').length || 0;

    console.log('📊 Stats:', { total, pending, processing, ready, claimed, rejected });

    // =============================================
    // DOCUMENT DISTRIBUTION (from requests table)
    // =============================================
    const documentMap = new Map();
    requests?.forEach(req => {
      const docType = req.request_type;
      if (docType) {
        documentMap.set(docType, (documentMap.get(docType) || 0) + 1);
      }
    });

    const documentDistribution = Array.from(documentMap.entries())
      .map(([name, count]) => ({
        name: name.length > 40 ? name.substring(0, 40) + '...' : name,
        count,
        percentage: total > 0 ? ((count / total) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // =============================================
    // COURSE DISTRIBUTION (from USERS table)
    // =============================================
    const courseMap = new Map();
    users?.forEach(user => {
      const course = user.course;
      if (course) {
        courseMap.set(course, (courseMap.get(course) || 0) + 1);
      }
    });

    const courseDistribution = Array.from(courseMap.entries())
      .map(([name, count]) => ({
        name: name.length > 40 ? name.substring(0, 40) + '...' : name,
        count,
        percentage: users?.length > 0 ? ((count / users.length) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    console.log('📚 Course Distribution (from users):', courseDistribution);

    // =============================================
    // DEPARTMENT DISTRIBUTION (from USERS table)
    // =============================================
    const departmentNames = {
      'CAS': 'College of Arts and Sciences (CAS)',
      'COED': 'College of Education (COED)',
      'CCS': 'College of Computer Studies (CCS)',
      'COF': 'College of Fisheries (COF)',
      'CIAS': 'College of Islamic and Arabic Studies (CIAS)',
      'IOES': 'Institute of Oceanography & Environmental Science (IOES)'
    };

    const departmentMap = new Map();
    users?.forEach(user => {
      let dept = user.department;
      if (dept && departmentNames[dept]) {
        dept = departmentNames[dept];
      }
      if (dept) {
        departmentMap.set(dept, (departmentMap.get(dept) || 0) + 1);
      }
    });

    const departmentDistribution = Array.from(departmentMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: users?.length > 0 ? ((count / users.length) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.count - a.count);

    console.log('🏛️ Department Distribution (from users):', departmentDistribution);

    // =============================================
    // YEAR LEVEL DISTRIBUTION (from users table via request sender)
    // =============================================
    const yearLevelMap = new Map();
    requests?.forEach(req => {
      const user = userMap.get(req.sender_id);
      if (user && user.year_level) {
        const yearLevel = user.year_level;
        yearLevelMap.set(yearLevel, (yearLevelMap.get(yearLevel) || 0) + 1);
      }
    });

    const yearLevelOrder = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
    const yearLevelDistribution = yearLevelOrder.map(level => ({
      name: level,
      count: yearLevelMap.get(level) || 0,
      percentage: total > 0 ? (((yearLevelMap.get(level) || 0) / total) * 100).toFixed(1) : 0
    }));

    // =============================================
    // USER TYPE DISTRIBUTION (from users table)
    // =============================================
    const studentCount = users?.filter(u => u.role === 'student').length || 0;
    const alumniCount = users?.filter(u => u.role === 'alumni').length || 0;
    const totalUsers = studentCount + alumniCount;

    const userTypeDistribution = [
      {
        type: 'Student',
        count: studentCount,
        percentage: totalUsers > 0 ? ((studentCount / totalUsers) * 100).toFixed(1) : 0,
        icon: 'FaUserGraduate'
      },
      {
        type: 'Alumni',
        count: alumniCount,
        percentage: totalUsers > 0 ? ((alumniCount / totalUsers) * 100).toFixed(1) : 0,
        icon: 'FaUserTie'
      }
    ];

    // =============================================
    // WEEKLY ACTIVITY (Last 7 days)
    // =============================================
    const today = new Date();
    const weeklyData = [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      
      const count = requests?.filter(req => {
        const reqDate = new Date(req.date_sent);
        return reqDate >= date && reqDate < nextDate;
      }).length || 0;
      
      weeklyData.push(count);
    }

    // =============================================
    // MONTHLY ACTIVITY (Last 12 months)
    // =============================================
    const monthlyData = new Array(12).fill(0);
    requests?.forEach(req => {
      const reqDate = new Date(req.date_sent);
      const month = reqDate.getMonth();
      monthlyData[month]++;
    });

    // =============================================
    // SEND RESPONSE
    // =============================================
    res.json({
      success: true,
      total,
      pending,
      processing,
      ready,
      claimed,
      rejected,
      documentDistribution,
      departmentDistribution,
      courseDistribution,
      yearLevelDistribution,
      userTypeDistribution,
      activityData: {
        weekly: weeklyData,
        monthly: monthlyData,
        labels: {
          weekly: days,
          monthly: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        }
      }
    });

  } catch (err) {
    console.error('❌ Dashboard stats error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};