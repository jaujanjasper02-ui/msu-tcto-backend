// backend/src/controllers/settingsController.js

import { supabase } from '../config/supabase.js';

// =============================================
// GET SYSTEM SETTINGS
// =============================================
export const getSettings = async (req, res) => {
  try {
    let { data: settings, error } = await supabase
      .from('system_settings')
      .select('*')
      .single();

    if (error && error.code === 'PGRST116') {
      // Default settings
      const defaultSettings = {
        system_name: 'MSU-TCTO Registrar System',
        contact_email: 'registraroffice@msutcto.edu.ph',
        office_hours: 'Monday to Friday, 8:00 AM - 4:45 PM',
        daily_queue_limit: 100,
        avg_processing_time: 10,
        max_copies_per_request: 5,
        require_purpose: true,
        email_notifications: {
          on_new_request: true,
          on_status_change: true,
          on_completion: true
        },
        document_settings: [
          { id: 1, name: 'Transcript of Records (TOR)', fee: 50.00, processing_days: 6, category: 'School Records' },
          { id: 2, name: 'Authentication', fee: 50.00, processing_days: 2, category: 'School Records' },
          { id: 3, name: 'Transfer Credential/Honorable Dismissal', fee: 50.00, processing_days: 3, category: 'School Records' },
          { id: 4, name: 'Report of Grade (ROG)/Evaluation', fee: 20.00, processing_days: 1, category: 'School Records' },
          { id: 5, name: 'Certificate of Registration (COR)', fee: 5.00, processing_days: 1, category: 'School Records' },
          { id: 6, name: 'Reprinting Fee (Grade)', fee: 5.00, processing_days: 1, category: 'School Records' },
          { id: 7, name: 'Certificate of Grade (per semester)', fee: 5.00, processing_days: 1, category: 'School Records' },
          { id: 8, name: 'Certification', fee: 50.00, processing_days: 2, category: 'School Records' },
          { id: 9, name: 'CAV', fee: 150.00, processing_days: 2, category: 'School Records' },
          { id: 10, name: 'University Clearance Form', fee: 5.00, processing_days: 1, category: 'Forms' },
          { id: 11, name: 'INC Form', fee: 20.00, processing_days: 1, category: 'Forms' },
          { id: 12, name: 'Advance Credit/s Form', fee: 20.00, processing_days: 1, category: 'Forms' },
          { id: 13, name: 'Application for Graduation Form', fee: 50.00, processing_days: 1, category: 'Forms' }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: newSettings, error: insertError } = await supabase
        .from('system_settings')
        .insert([defaultSettings])
        .select()
        .single();

      if (insertError) throw insertError;
      
      // Format response para sa frontend
      return res.status(200).json({
        success: true,
        settings: {
          system_name: newSettings.system_name,
          contact_email: newSettings.contact_email,
          office_hours: newSettings.office_hours,
          daily_queue_limit: newSettings.daily_queue_limit,
          avg_processing_time: newSettings.avg_processing_time,
          max_copies_per_request: newSettings.max_copies_per_request,
          require_purpose: newSettings.require_purpose,
          email_notifications: newSettings.email_notifications,
          document_settings: newSettings.document_settings
        }
      });
    }

    if (error) throw error;

    // Format response para sa frontend
    res.status(200).json({
      success: true,
      settings: {
        system_name: settings.system_name,
        contact_email: settings.contact_email,
        office_hours: settings.office_hours,
        daily_queue_limit: settings.daily_queue_limit,
        avg_processing_time: settings.avg_processing_time,
        max_copies_per_request: settings.max_copies_per_request,
        require_purpose: settings.require_purpose,
        email_notifications: settings.email_notifications,
        document_settings: settings.document_settings
      }
    });
    
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// UPDATE SYSTEM SETTINGS
// =============================================
export const updateSettings = async (req, res) => {
  try {
    const {
      systemName,
      contactEmail,
      officeHours,
      dailyQueueLimit,
      avgProcessingTime,
      maxCopiesPerRequest,
      requirePurpose,
      emailNotifications,
      documentSettings
    } = req.body;

    console.log('📝 Updating settings:', { systemName, contactEmail, dailyQueueLimit });

    // Get current settings
    let { data: currentSettings, error: fetchError } = await supabase
      .from('system_settings')
      .select('*')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // Prepare update data (match column names sa database)
    const updateData = {
      system_name: systemName,
      contact_email: contactEmail,
      office_hours: officeHours,
      daily_queue_limit: dailyQueueLimit,
      avg_processing_time: avgProcessingTime,
      max_copies_per_request: maxCopiesPerRequest,
      require_purpose: requirePurpose,
      email_notifications: emailNotifications,
      document_settings: documentSettings,
      updated_at: new Date().toISOString()
    };

    let result;

    if (currentSettings) {
      // Update existing
      const { data, error: updateError } = await supabase
        .from('system_settings')
        .update(updateData)
        .eq('id', currentSettings.id)
        .select()
        .single();

      if (updateError) throw updateError;
      result = data;
    } else {
      // Insert new
      updateData.created_at = new Date().toISOString();
      const { data, error: insertError } = await supabase
        .from('system_settings')
        .insert([updateData])
        .select()
        .single();

      if (insertError) throw insertError;
      result = data;
    }

    console.log('✅ Settings updated successfully');

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        system_name: result.system_name,
        contact_email: result.contact_email,
        office_hours: result.office_hours,
        daily_queue_limit: result.daily_queue_limit,
        avg_processing_time: result.avg_processing_time,
        max_copies_per_request: result.max_copies_per_request,
        require_purpose: result.require_purpose,
        email_notifications: result.email_notifications,
        document_settings: result.document_settings
      }
    });
    
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: err.message });
  }
};