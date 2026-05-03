// =============================================
// EMAIL TEMPLATES FOR STATUS UPDATES
// =============================================

// Format date nicely
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Approved & Processing Template
export const getApprovedTemplate = (data) => {
  const {
    studentName,
    trackingCode,
    documentType,
    dateSubmitted,
    amount,
    estimatedCompletion
  } = data;

  const subject = `✅ Request Approved - ${trackingCode}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #7A0019; margin: 0;">MSU-TCTO Registrar</h2>
        <p style="color: #666;">Mindanao State University - Tawi-Tawi</p>
      </div>
      
      <div style="background-color: #f0f7ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: #0038A8; margin: 0;">✅ Request Approved & Processing</h3>
      </div>
      
      <p>Dear <strong>${studentName}</strong>,</p>
      
      <p>Your request has been <strong style="color: #0038A8;">APPROVED</strong> and is now being <strong>PROCESSING</strong>.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #333;">📋 Request Details:</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Request ID:</td>
            <td style="padding: 8px 0; font-weight: bold;">${trackingCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Document:</td>
            <td style="padding: 8px 0; font-weight: bold;">${documentType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Date Submitted:</td>
            <td style="padding: 8px 0;">${formatDate(dateSubmitted)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Amount to Pay:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #7A0019;">₱${amount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Est. Completion:</td>
            <td style="padding: 8px 0;">${formatDate(estimatedCompletion)}</td>
          </tr>
        </table>
      </div>
      
      <div style="margin: 20px 0;">
        <h4 style="color: #333;">📌 Next Steps:</h4>
        <ol style="color: #666; padding-left: 20px;">
          <li>Wait for "Ready for Pickup" notification</li>
          <li>Prepare payment amount of ₱${amount}</li>
          <li>Bring valid ID to Registrar's Office when ready</li>
        </ol>
      </div>
      
      <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
        <p style="color: #666; font-size: 14px;">Thank you for using MSU-TCTO Registrar System.</p>
        <p style="color: #999; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    </div>
  `;

  return { subject, html };
};

// Ready for Pickup Template
export const getReadyTemplate = (data) => {
  const {
    studentName,
    trackingCode,
    documentType,
    amount,
    estimatedCompletion
  } = data;

  const subject = `📦 Document Ready for Pickup - ${trackingCode}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #7A0019; margin: 0;">MSU-TCTO Registrar</h2>
        <p style="color: #666;">Mindanao State University - Tawi-Tawi</p>
      </div>
      
      <div style="background-color: #f3e5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: #7B1FA2; margin: 0;">📦 Ready for Pickup!</h3>
      </div>
      
      <p>Dear <strong>${studentName}</strong>,</p>
      
      <p>Your document is now <strong style="color: #7B1FA2;">READY FOR PICKUP</strong> at the Registrar's Office.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #333;">📋 Request Details:</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Request ID:</td>
            <td style="padding: 8px 0; font-weight: bold;">${trackingCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Document:</td>
            <td style="padding: 8px 0; font-weight: bold;">${documentType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Amount to Pay:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #7A0019;">₱${amount}</td>
          </tr>
        </table>
      </div>
      
      <div style="margin: 20px 0;">
        <h4 style="color: #333;">📍 CLAIMING PROCESS:</h4>
        <ol style="color: #666; padding-left: 20px;">
          <li><strong>Go to Cashier Office</strong> - Pay ₱${amount} and get Official Receipt</li>
          <li><strong>Go to Registrar Office</strong> - Present Official Receipt and Valid ID</li>
          <li><strong>Sign release form</strong> and claim your document</li>
        </ol>
        <p style="color: #e65100; font-size: 14px; margin-top: 15px;">
          ⚠️ Claim within 30 days, otherwise document will be forfeited.
        </p>
      </div>
      
      <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
        <p style="color: #666; font-size: 14px;">Thank you for using MSU-TCTO Registrar System.</p>
        <p style="color: #999; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    </div>
  `;

  return { subject, html };
};

// Rejected Template
export const getRejectedTemplate = (data) => {
  const {
    studentName,
    trackingCode,
    documentType,
    rejectionReason,
    rejectedDate
  } = data;

  const subject = `❌ Request Rejected - ${trackingCode}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #7A0019; margin: 0;">MSU-TCTO Registrar</h2>
        <p style="color: #666;">Mindanao State University - Tawi-Tawi</p>
      </div>
      
      <div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: #c62828; margin: 0;">❌ Request Rejected</h3>
      </div>
      
      <p>Dear <strong>${studentName}</strong>,</p>
      
      <p>Your request has been <strong style="color: #c62828;">REJECTED</strong>.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #333;">📋 Request Details:</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Request ID:</td>
            <td style="padding: 8px 0; font-weight: bold;">${trackingCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Document:</td>
            <td style="padding: 8px 0; font-weight: bold;">${documentType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Rejection Date:</td>
            <td style="padding: 8px 0;">${formatDate(rejectedDate)}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #e65100;">❌ Rejection Reason:</h4>
        <p style="color: #666; font-size: 16px;">${rejectionReason || 'No reason provided'}</p>
      </div>
      
      <div style="margin: 20px 0;">
        <p style="color: #666;">
          If you have questions or need to appeal, please contact the Registrar's Office:
        </p>
        <p style="color: #333;">
          📞 (068) 123-4567<br>
          📍 Registrar's Office, MSU-TCTO, Sanga-Sanga, Bongao Tawi-Tawi
        </p>
      </div>
      
      <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
        <p style="color: #666; font-size: 14px;">Thank you for using MSU-TCTO Registrar System.</p>
        <p style="color: #999; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    </div>
  `;

  return { subject, html };
};