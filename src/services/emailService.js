import { sendEmail } from '../config/email.js';
import { 
  getApprovedTemplate, 
  getReadyTemplate, 
  getRejectedTemplate 
} from '../utils/emailTemplates.js';
import { supabase } from '../config/supabase.js';

// =============================================
// 🆕 HELPER: GET EMAIL NOTIFICATION SETTINGS
// =============================================
const getEmailNotificationSettings = async () => {
  const { data: settings } = await supabase
    .from('system_settings')
    .select('email_notifications')
    .single();

  return settings?.email_notifications || {
    on_new_request: true,
    on_status_change: true,
    on_completion: true
  };
};

// =============================================
// SAVE EMAIL LOG TO DATABASE
// =============================================
const saveEmailLog = async (logData) => {
  try {
    const { error } = await supabase
      .from('email_logs')
      .insert([logData]);

    if (error) {
      console.error('❌ Failed to save email log:', error);
    }
  } catch (err) {
    console.error('❌ Error saving email log:', err);
  }
};

// =============================================
// 🆕 SEND STATUS UPDATE EMAIL (WITH NOTIFICATION CHECK)
// =============================================
export const sendStatusEmail = async (request, newStatus, reason = null) => {
  let logData = {
    request_id: request.id,
    email_type: newStatus,
    status: 'failed',
    sent_at: new Date().toISOString()
  };

  try {
    // 🆕 CHECK EMAIL NOTIFICATION SETTINGS
    const emailSettings = await getEmailNotificationSettings();

    // 🆕 Kung ang newStatus ay 'approved' o 'processing' → tingnan ang on_status_change
    if ((newStatus === 'approved' || newStatus === 'processing') && !emailSettings.on_status_change) {
      console.log(`📧 on_status_change is OFF — skipping email for ${newStatus}`);
      logData.recipient_email = 'none';
      logData.subject = `Skipped - on_status_change disabled`;
      logData.status = 'sent';
      logData.error_message = 'Notification disabled in settings';
      await saveEmailLog(logData);
      return { success: true, message: 'Notification disabled in settings' };
    }

    // 🆕 Kung ang newStatus ay 'ready' → tingnan ang on_completion
    if (newStatus === 'ready' && !emailSettings.on_completion) {
      console.log('📧 on_completion is OFF — skipping Ready for Pickup email');
      logData.recipient_email = 'none';
      logData.subject = 'Skipped - on_completion disabled';
      logData.status = 'sent';
      logData.error_message = 'Notification disabled in settings';
      await saveEmailLog(logData);
      return { success: true, message: 'Notification disabled in settings' };
    }

    // 🆕 Kung ang newStatus ay 'rejected' → tingnan ang on_status_change (kasama ang rejection)
    if (newStatus === 'rejected' && !emailSettings.on_status_change) {
      console.log('📧 on_status_change is OFF — skipping Rejection email');
      logData.recipient_email = 'none';
      logData.subject = 'Skipped - on_status_change disabled';
      logData.status = 'sent';
      logData.error_message = 'Notification disabled in settings';
      await saveEmailLog(logData);
      return { success: true, message: 'Notification disabled in settings' };
    }

    // Get user's email from database
    const { data: user, error } = await supabase
      .from('users')
      .select('email, first_name')
      .eq('id', request.sender_id)
      .single();

    if (error || !user) {
      console.error('❌ Could not find user email:', error);
      logData.error_message = 'User not found';
      await saveEmailLog(logData);
      return { success: false, error: 'User not found' };
    }

    if (!user.email) {
      console.log('⚠️ User has no email address:', request.sender_id);
      logData.error_message = 'No email address';
      logData.recipient_email = 'none';
      await saveEmailLog(logData);
      return { success: false, error: 'No email address' };
    }

    const emailData = {
      studentName: request.sender_name || user.first_name,
      trackingCode: request.tracking_code,
      documentType: request.request_type,
      dateSubmitted: request.date_sent,
      amount: calculateAmount(request),
      estimatedCompletion: request.estimated_completion_date,
      rejectionReason: reason,
      rejectedDate: new Date()
    };

    let emailContent;

    switch(newStatus) {
      case 'approved':
      case 'processing':
        emailContent = getApprovedTemplate(emailData);
        break;
      case 'ready':
        emailContent = getReadyTemplate(emailData);
        break;
      case 'rejected':
        emailContent = getRejectedTemplate(emailData);
        break;
      default:
        return { success: false, error: 'Unknown status' };
    }

    // Update log data with email info
    logData.recipient_email = user.email;
    logData.subject = emailContent.subject;

    const result = await sendEmail(
      user.email,
      emailContent.subject,
      emailContent.html
    );

    if (result.success) {
      console.log(`✅ Status email sent to ${user.email} for ${request.tracking_code}`);
      logData.status = 'sent';
      logData.error_message = null;
    } else {
      console.error(`❌ Failed to send email for ${request.tracking_code}:`, result.error);
      logData.status = 'failed';
      logData.error_message = result.error;
    }

    // Save log to database
    await saveEmailLog(logData);

    return result;

  } catch (error) {
    console.error('❌ Error in sendStatusEmail:', error);
    logData.error_message = error.message;
    await saveEmailLog(logData);
    return { success: false, error: error.message };
  }
};

// Helper to calculate amount
const calculateAmount = (request) => {
  const priceMap = {
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
  
  const price = priceMap[request.request_type] || 0;
  return (price * (request.copies || 1)).toFixed(2);
};