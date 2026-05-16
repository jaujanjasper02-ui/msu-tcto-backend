import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = '8h';

const createDefaultAdminIfNeeded = async () => {
  try {
    const { count, error } = await supabase
      .from('admins')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error checking admins:', error);
      return null;
    }
    
    if (count === 0) {
      console.log('📝 No admin found. Creating default admin...');
      
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash('admin123', salt);
      
      const { data: newAdmin, error: insertError } = await supabase
        .from('admins')
        .insert([{
          username: 'superadmin',
          full_name: 'System Administrator',
          email: 'admin@msutcto.edu.ph',
          password_hash: password_hash,
          role: 'super_admin',
          department: 'ALL',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }
      
      console.log('✅ Default admin created successfully!');
      console.log('   Username: superadmin');
      console.log('   Password: admin123');
      
      return newAdmin;
    }
    
    return null;
  } catch (err) {
    console.error('Error creating default admin:', err);
    return null;
  }
};

export const adminLogin = async (req, res) => {
  try {
    console.log('📥 Login request received. Body:', req.body);

    const { username, password } = req.body;

    await createDefaultAdminIfNeeded();

    if (!username || !password) {
      console.log('❌ Missing username or password');
      return res.status(400).json({ 
        message: 'Username and password are required' 
      });
    }

    console.log(`🔍 Looking for admin with username: "${username}"`);

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      console.log('❌ Supabase error:', error);
    }

    if (!admin) {
      console.log('❌ Admin not found for username:', username);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    console.log('✅ Admin found:', { id: admin.id, username: admin.username, is_active: admin.is_active });
    console.log('📦 Stored hash (first 20 chars):', admin.password_hash?.substring(0, 20));

    if (!admin.is_active) {
      console.log('❌ Account is deactivated');
      return res.status(401).json({ 
        message: 'Account is deactivated. Please contact the system administrator.' 
      });
    }

    console.log('🔐 Comparing password...');
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    console.log('🔐 Password match result:', isValidPassword);

    if (!isValidPassword) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Update last login
    await supabase
      .from('admins')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.id);

    const token = jwt.sign(
      { 
        userId: admin.id,
        role: admin.role,
        department: admin.department || 'CCS',
        type: 'admin',
        username: admin.username
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const { password_hash, ...adminData } = admin;

    console.log('✅ Login successful:', { username: admin.username, role: admin.role });

    res.status(200).json({
      message: 'Login successful',
      token,
      admin: adminData,
      user: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        department: admin.department,
        name: admin.full_name
      }
    });

  } catch (err) {
    console.error('🔥 Admin login error:', err);
    res.status(500).json({ 
      message: 'Login failed. Please try again.' 
    });
  }
};

export const adminRegister = async (req, res) => {
  try {
    const { 
      username, 
      password, 
      email, 
      full_name, 
      role = 'admin',
      department 
    } = req.body;

    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        message: 'Only super admins can create new admins' 
      });
    }

    if (!username || !password) {
      return res.status(400).json({ 
        message: 'Username and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters' 
      });
    }

    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('username')
      .eq('username', username)
      .single();

    if (existingAdmin) {
      return res.status(409).json({ 
        message: 'Username already exists' 
      });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data: admin, error } = await supabase
      .from('admins')
      .insert([{
        username,
        password_hash,
        email,
        full_name,
        role,
        department,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    const { password_hash: _, ...adminData } = admin;

    res.status(201).json({
      message: 'Admin created successfully',
      admin: adminData
    });

  } catch (err) {
    console.error('Admin registration error:', err);
    res.status(500).json({ 
      message: 'Registration failed. Please try again.' 
    });
  }
};

export const getCurrentAdmin = async (req, res) => {
  try {
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, username, email, full_name, role, department, last_login, created_at, is_active')
      .eq('id', req.user.userId)
      .single();

    if (error || !admin) {
      return res.status(404).json({ 
        message: 'Admin not found' 
      });
    }

    res.status(200).json(admin);

  } catch (err) {
    console.error('Get current admin error:', err);
    res.status(500).json({ 
      message: 'Failed to get admin data' 
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const adminId = req.user.userId;

    if (!current_password || !new_password) {
      return res.status(400).json({ 
        message: 'Current password and new password are required' 
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ 
        message: 'New password must be at least 6 characters' 
      });
    }

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', adminId)
      .single();

    if (error || !admin) {
      return res.status(404).json({ 
        message: 'Admin not found' 
      });
    }

    const isValidPassword = await bcrypt.compare(current_password, admin.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        message: 'Current password is incorrect' 
      });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);
    const { error: updateError } = await supabase
      .from('admins')
      .update({ 
        password_hash,
        updated_at: new Date().toISOString()
      })
      .eq('id', adminId);

    if (updateError) throw updateError;

    res.status(200).json({ 
      message: 'Password changed successfully' 
    });

  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ 
      message: 'Failed to change password' 
    });
  }
};

export const getAllAdmins = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        message: 'Only super admins can view all admins' 
      });
    }

    const { data: admins, error } = await supabase
      .from('admins')
      .select('id, username, email, full_name, role, department, is_active, last_login, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json(admins);

  } catch (err) {
    console.error('Get all admins error:', err);
    res.status(500).json({ 
      message: 'Failed to get admins' 
    });
  }
};

export const updateAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, role } = req.body;

    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        message: 'Only super admins can update admin status' 
      });
    }

    if (id === req.user.userId && is_active === false) {
      return res.status(400).json({ 
        message: 'You cannot deactivate your own account' 
      });
    }

    const updates = {
      ...(is_active !== undefined && { is_active }),
      ...(role !== undefined && { role }),
      updated_at: new Date().toISOString()
    };

    const { data: admin, error } = await supabase
      .from('admins')
      .update(updates)
      .eq('id', id)
      .select('id, username, email, full_name, role, is_active')
      .single();

    if (error) throw error;

    res.status(200).json({
      message: 'Admin updated successfully',
      admin
    });

  } catch (err) {
    console.error('Update admin status error:', err);
    res.status(500).json({ 
      message: 'Failed to update admin' 
    });
  }
};

export const verifyAdminToken = async (req, res) => {
  try {
    const adminId = req.user.userId;
    const role = req.user.role;
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, username, role, is_active')
      .eq('id', adminId)
      .single();

    if (error || !admin || !admin.is_active) {
      return res.status(401).json({ 
        message: 'Admin account is inactive or not found' 
      });
    }

    res.status(200).json({
      valid: true,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      }
    });

  } catch (err) {
    console.error('Verify admin token error:', err);
    res.status(500).json({ 
      message: 'Failed to verify token' 
    });
  }
};