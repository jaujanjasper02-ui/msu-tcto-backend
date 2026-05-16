// backend/src/controllers/settingsController.js

import { supabase } from '../config/supabase.js';

// =============================================
// GET SETTINGS (Admin)
// =============================================
export const getSettings = async (req, res) => {
  try {
    let { data: settings, error } = await supabase
      .from('system_settings')
      .select('*')
      .single();

    if (error && error.code === 'PGRST116') {
      const defaultSettings = {
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
        document_settings: []
      };

      const { data: newSettings, error: insertError } = await supabase
        .from('system_settings')
        .insert([defaultSettings])
        .select()
        .single();

      if (insertError) throw insertError;
      
      return res.status(200).json({
        success: true,
        settings: {
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

    res.status(200).json({
      success: true,
      settings: {
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
// UPDATE SETTINGS (Admin)
// =============================================
export const updateSettings = async (req, res) => {
  try {
    const {
      contactEmail,
      officeHours,
      dailyQueueLimit,
      avgProcessingTime,
      maxCopiesPerRequest,
      requirePurpose,
      emailNotifications,
      documentSettings
    } = req.body;

    let { data: currentSettings, error: fetchError } = await supabase
      .from('system_settings')
      .select('*')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    const updateData = {
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
      const { data, error: updateError } = await supabase
        .from('system_settings')
        .update(updateData)
        .eq('id', currentSettings.id)
        .select()
        .single();

      if (updateError) throw updateError;
      result = data;
    } else {
      updateData.created_at = new Date().toISOString();
      const { data, error: insertError } = await supabase
        .from('system_settings')
        .insert([updateData])
        .select()
        .single();

      if (insertError) throw insertError;
      result = data;
    }

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
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

// =============================================
// 🆕 GET PUBLIC SETTINGS (No Auth Required)
// Used by Student Frontend for fees, limits, etc.
// =============================================
export const getPublicSettings = async (req, res) => {
  try {
    let { data: settings, error } = await supabase
      .from('system_settings')
      .select('contact_email, office_hours, daily_queue_limit, avg_processing_time, max_copies_per_request, require_purpose, document_settings')
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(200).json({
        contact_email: 'registraroffice@msutcto.edu.ph',
        office_hours: 'Monday to Friday, 8:00 AM - 4:45 PM',
        daily_queue_limit: 100,
        avg_processing_time: 10,
        max_copies_per_request: 5,
        require_purpose: true,
        document_settings: []
      });
    }

    if (error) {
      return res.status(200).json({
        contact_email: 'registraroffice@msutcto.edu.ph',
        office_hours: 'Monday to Friday, 8:00 AM - 4:45 PM',
        daily_queue_limit: 100,
        avg_processing_time: 10,
        max_copies_per_request: 5,
        require_purpose: true,
        document_settings: []
      });
    }

    res.status(200).json({
      contact_email: settings.contact_email,
      office_hours: settings.office_hours,
      daily_queue_limit: settings.daily_queue_limit,
      avg_processing_time: settings.avg_processing_time,
      max_copies_per_request: settings.max_copies_per_request,
      require_purpose: settings.require_purpose,
      document_settings: settings.document_settings
    });
    
  } catch (err) {
    console.error('Error fetching public settings:', err);
    res.status(200).json({
      contact_email: 'registraroffice@msutcto.edu.ph',
      office_hours: 'Monday to Friday, 8:00 AM - 4:45 PM',
      daily_queue_limit: 100,
      avg_processing_time: 10,
      max_copies_per_request: 5,
      require_purpose: true,
      document_settings: []
    });
  }
};