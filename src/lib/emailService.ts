import emailjs from '@emailjs/browser';

const publicKey = '6-p_2zQs2LOjsw3Cc';
const serviceId = 'service_2rfobei';
const templateId = 'template_kpk620q';

// Initialize emailjs if public key is provided
if (publicKey && publicKey !== 'your_public_key_here') {
  emailjs.init(publicKey);
}

export const sendShipmentEmail = async (shipment: any) => {
  if (!serviceId || serviceId === 'your_service_id_here') return console.warn('EmailJS not configured. Skipping shipment email.');
  
  const toEmail = shipment.receiver_email || shipment.to?.email || shipment.userEmail;
  const trackingNumber = shipment.trackingNumber || shipment.tracking_code || "Unknown";
  const senderName = shipment.from?.name || shipment.sender_name || "SWIFTLY LOGIX Logistics";
  
  if (!toEmail) return;

  const extraDetailsHtml = `
    <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #4B5563;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #4B5563;"><strong>Service:</strong> ${shipment.service || "Standard Delivery"}</p>
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #4B5563;"><strong>Origin:</strong> ${senderName}</p>
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #4B5563;"><strong>Destination:</strong> ${shipment.to?.name || shipment.receiver_name || "Recipient"}</p>
      <p style="margin: 0; font-size: 14px; color: #4B5563;"><strong>Expected Delivery:</strong> ${shipment.estimatedDelivery || shipment.expected_delivery_date || "TBD"}</p>
    </div>
  `;

  try {
    await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      to_name: shipment.to?.name || shipment.receiver_name || "Customer",
      notification_type: "SHIPMENT UPDATE",
      main_title: "A new shipment is on its way to you",
      message_body: `${senderName} has just created a shipment for you. You can track the progress of your package by clicking the button below.`,
      extra_details_html: extraDetailsHtml,
      action_text: "Track Package",
      action_url: `https://swiftlylogix.com/tracking?tn=${trackingNumber}`
    });
    console.log('Shipment email sent successfully');
  } catch (error) {
    console.error('Failed to send shipment email:', error);
  }
};

export const sendBillEmail = async (toEmail: string, title: string, amount: number, note: string, hasAttachment?: boolean | string) => {
  if (!serviceId || serviceId === 'your_service_id_here') return console.warn('EmailJS not configured. Skipping bill email.');
  
  // Build a clean receipt-style HTML block
  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });

  const extraDetailsHtml = `
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <h3 style="margin-top: 0; margin-bottom: 16px; color: #111827; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px;">Invoice Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; color: #6b7280; font-size: 14px;">Invoice</td>
          <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">${title}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; color: #6b7280; font-size: 14px;">Amount Due</td>
          <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; color: #dc2626; font-size: 16px; font-weight: bold; text-align: right;">$${amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; color: #6b7280; font-size: 14px;">Date Issued</td>
          <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Attachment</td>
          <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">${hasAttachment ? '📎 Included — view in dashboard' : 'None'}</td>
        </tr>
      </table>
    </div>
  `;
    
  try {
    await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      notification_type: "BILLING INVOICE",
      main_title: `New Invoice: ${title}`,
      message_body: `A new invoice of $${amount.toFixed(2)} has been issued to your account.\n\n${note}\n\nPlease log into your dashboard to view the full invoice details and any attached documents.`,
      extra_details_html: extraDetailsHtml,
      action_text: "View Invoice",
      action_url: `https://swiftlylogix.com/billing`
    });
    console.log('Bill email sent successfully to:', toEmail);
  } catch (error) {
    console.error('Failed to send bill email:', error);
  }
};

export const sendBillClearedEmail = async (toEmail: string, title: string, amount: number) => {
  if (!serviceId || serviceId === 'your_service_id_here') return console.warn('EmailJS not configured.');
  try {
    await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      notification_type: "BILL CLEARED",
      main_title: `Payment Successful: ${title}`,
      message_body: `Good news! Your payment of $${amount.toFixed(2)} for ${title} has been successfully approved and cleared by our team. Your shipment is now fully processed and on its way to you!`,
      extra_details_html: "",
      action_text: "Track Shipment",
      action_url: `https://swiftlylogix.com/tracking`
    });
    console.log('Bill cleared email sent successfully');
  } catch (error) {
    console.error('Failed to send bill cleared email:', error);
  }
};

export const sendBillPaidEmail = async (receiverEmail: string, bill: { id: string; title: string; amount: number; paidAt?: string }) => {
  if (!serviceId || serviceId === 'your_service_id_here') return console.warn('EmailJS not configured. Skipping bill paid email.');
  
  const paymentDate = bill.paidAt ? new Date(bill.paidAt) : new Date();
  const formattedDate = paymentDate.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = paymentDate.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' });

  const extraDetailsHtml = `
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <h3 style="margin-top: 0; margin-bottom: 16px; color: #111827; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px;">Payment Receipt</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; color: #6b7280; font-size: 14px;">Invoice ID</td>
          <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; color: #111827; font-size: 14px; font-weight: bold; text-align: right; font-family: monospace;">#${bill.id.split('-')[1]?.toUpperCase() || bill.id}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; color: #6b7280; font-size: 14px;">Amount Paid</td>
          <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; color: #059669; font-size: 16px; font-weight: bold; text-align: right;">$${bill.amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; color: #6b7280; font-size: 14px;">Date</td>
          <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Time</td>
          <td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">${formattedTime}</td>
        </tr>
      </table>
    </div>
  `;

  try {
    await emailjs.send(serviceId, templateId, {
      to_email: receiverEmail,
      notification_type: "INVOICE PAID",
      main_title: `Invoice Paid: ${bill.title}`,
      message_body: `Great news! The invoice "${bill.title}" for $${bill.amount.toFixed(2)} has been paid successfully. Your shipment is now fully cleared and on its way to you. You can track its progress using the link below.`,
      extra_details_html: extraDetailsHtml,
      action_text: "Track Shipment",
      action_url: `https://swiftlylogix.com/tracking`
    });
    console.log('Bill paid email sent to receiver:', receiverEmail);
  } catch (error) {
    console.error('Failed to send bill paid email:', error);
  }
};

export const sendDepositEmail = async (toEmail: string, amount: number, status: string) => {
  if (!serviceId || serviceId === 'your_service_id_here') return console.warn('EmailJS not configured. Skipping deposit email.');
  
  const isApproved = status.toLowerCase() === "approved";
  
  try {
    await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      notification_type: "DEPOSIT STATUS",
      main_title: isApproved ? "Deposit Approved" : "Deposit Rejected",
      message_body: isApproved 
        ? `Great news! Your deposit of $${amount.toFixed(2)} has been approved and successfully credited to your account balance.`
        : `Unfortunately, your deposit of $${amount.toFixed(2)} could not be approved at this time. Please contact support if you believe this is an error.`,
      extra_details_html: "",
      action_text: "View Dashboard",
      action_url: `https://swiftlylogix.com/dashboard`
    });
    console.log('Deposit email sent successfully');
  } catch (error) {
    console.error('Failed to send deposit email:', error);
  }
};

export const sendAccountEmail = async (toEmail: string, status: string) => {
  if (!serviceId || serviceId === 'your_service_id_here') return console.warn('EmailJS not configured. Skipping account status email.');
  
  const isApproved = status.toLowerCase() === "approved";
  
  try {
    await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      notification_type: "ACCOUNT STATUS",
      main_title: isApproved ? "Welcome to SWIFTLY LOGIX!" : "Account Update",
      message_body: isApproved
        ? `Your account has been fully approved. You now have full access to the SWIFTLY LOGIX Logistics dashboard and can start tracking and managing your shipments.`
        : `After reviewing your application, we regret to inform you that your account has been declined. Please contact our support team for more details.`,
      extra_details_html: "",
      action_text: isApproved ? "Login Now" : "Contact Support",
      action_url: isApproved ? `https://swiftlylogix.com/auth/login` : `https://swiftlylogix.com/support/help-center`
    });
    console.log('Account status email sent successfully');
  } catch (error) {
    console.error('Failed to send account status email:', error);
  }
};
